// ============================================
// AR-ОТКРЫТКИ - ОТЛАДОЧНАЯ ВЕРСИЯ
// ============================================

let currentCard = null;
let arScene = null;
let videoElement = null;
let isSoundEnabled = false;
let isTracking = false;

// Функция для показа отладочных сообщений НА ЭКРАНЕ
function showDebug(message, isError = false) {
    console.log(message);
    
    const debugDiv = document.getElementById('debug-messages') || createDebugDiv();
    const msg = document.createElement('div');
    msg.style.cssText = `
        padding: 8px;
        margin: 4px 0;
        background: ${isError ? '#ff4444' : '#44ff44'};
        color: black;
        border-radius: 4px;
        font-size: 12px;
    `;
    msg.textContent = new Date().toLocaleTimeString() + ': ' + message;
    debugDiv.appendChild(msg);
    
    // Автоскролл вниз
    debugDiv.scrollTop = debugDiv.scrollHeight;
    
    // Убираем старые сообщения (оставляем последние 10)
    while (debugDiv.children.length > 10) {
        debugDiv.removeChild(debugDiv.firstChild);
    }
}

function createDebugDiv() {
    const div = document.createElement('div');
    div.id = 'debug-messages';
    div.style.cssText = `
        position: fixed;
        top: 80px;
        left: 10px;
        right: 10px;
        max-height: 200px;
        overflow-y: auto;
        background: rgba(0,0,0,0.8);
        padding: 10px;
        border-radius: 8px;
        z-index: 9999;
        font-family: monospace;
    `;
    document.body.appendChild(div);
    return div;
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    showDebug('📱 Приложение загружено');
    
    const urlParams = new URLSearchParams(window.location.search);
    const cardId = urlParams.get('id');
    
    if (!cardId) {
        showDebug('❌ ID открытки не указан', true);
        showCardSelection();
        return;
    }
    
    if (!CARDS[cardId]) {
        showDebug(`❌ Открытка "${cardId}" не найдена`, true);
        showError(`Открытка "${cardId}" не найдена`);
        return;
    }
    
    currentCard = CARDS[cardId];
    showDebug(`✅ Открытка: ${currentCard.title}`);
    
    document.getElementById('card-title').textContent = currentCard.title;
    
    arScene = document.getElementById('ar-scene');
    videoElement = document.getElementById('ar-video');
    
    document.getElementById('start-button').addEventListener('click', startARExperience);
    document.getElementById('retry-camera').addEventListener('click', startARExperience);
    document.getElementById('toggle-sound').addEventListener('click', toggleSound);
    
    showDebug('✅ Обработчики событий установлены');
});

// ============================================
// ПОКАЗАТЬ ЭКРАН ВЫБОРА
// ============================================
function showCardSelection() {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('select-screen').classList.remove('hidden');
    
    const cardsList = document.getElementById('cards-list');
    cardsList.innerHTML = '';
    
    Object.keys(CARDS).forEach(cardId => {
        const card = CARDS[cardId];
        const btn = document.createElement('button');
        btn.className = 'btn-card';
        btn.textContent = card.title;
        btn.onclick = () => {
            window.location.href = `?id=${cardId}`;
        };
        cardsList.appendChild(btn);
    });
}

// ============================================
// ЗАПУСК AR
// ============================================
async function startARExperience() {
    showDebug('🚀 Запуск AR...');
    
    const startScreen = document.getElementById('start-screen');
    const cameraError = document.getElementById('camera-error');
    
    try {
        // 1. Устанавливаем пути
        showDebug(`📁 mind: ${currentCard.mindUrl}`);
        showDebug(`🎬 video: ${currentCard.videoUrl}`);
        
        arScene.setAttribute('mindar-image', `imageTargetSrc: ${currentCard.mindUrl}; autoStart: false;`);
        videoElement.src = currentCard.videoUrl;
        videoElement.load();
        
        showDebug('✅ Ресурсы установлены');
        
        // 2. Скрываем стартовый экран
        startScreen.classList.add('hidden');
        arScene.classList.remove('hidden');
        
        showDebug('✅ Интерфейс переключён');
        
        // 3. Показываем элементы
        document.getElementById('tracking-hint').classList.remove('hidden');
        document.getElementById('sound-control').classList.remove('hidden');
        
        // 4. Запускаем AR
        showDebug('📷 Запрос камеры...');
        await requestCameraAndStartAR();
        
        showDebug('✅ AR запущен!');
        
        // 5. Настраиваем отслеживание
        setupTracking();
        
    } catch (error) {
        showDebug(`❌ ОШИБКА: ${error.message}`, true);
        console.error('Полная ошибка:', error);
        
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            startScreen.classList.add('hidden');
            cameraError.classList.remove('hidden');
        } else {
            showError(`Ошибка: ${error.message}`);
        }
    }
}

// ============================================
// ЗАПРОС КАМЕРЫ
// ============================================
async function requestCameraAndStartAR() {
    return new Promise((resolve, reject) => {
        showDebug('⏳ Ждём инициализацию MindAR...');
        
        const sceneEl = arScene;
        
        sceneEl.addEventListener('arReady', () => {
            showDebug('✅ AR готов!');
            resolve();
        }, { once: true });
        
        sceneEl.addEventListener('arError', (event) => {
            showDebug(`❌ AR ошибка: ${JSON.stringify(event.detail)}`, true);
            reject(event.detail);
        }, { once: true });
        
        // Проверяем систему MindAR
        let attempts = 0;
        const maxAttempts = 50; // 5 секунд
        
        const checkSystem = () => {
            attempts++;
            showDebug(`🔍 Попытка ${attempts}/${maxAttempts}`);
            
            if (sceneEl.systems && sceneEl.systems['mindar-image-system']) {
                showDebug('✅ Система MindAR найдена!');
                const mindAR = sceneEl.systems['mindar-image-system'];
                
                showDebug('🎥 Запуск камеры...');
                mindAR.start();
                
            } else if (attempts >= maxAttempts) {
                showDebug('❌ MindAR не загрузился за 5 секунд', true);
                reject(new Error('MindAR timeout'));
            } else {
                setTimeout(checkSystem, 100);
            }
        };
        
        checkSystem();
    });
}

// ============================================
// НАСТРОЙКА ОТСЛЕЖИВАНИЯ
// ============================================
function setupTracking() {
    showDebug('🎯 Настройка трекинга...');
    
    const targetEntity = document.getElementById('target-entity');
    
    targetEntity.addEventListener('targetFound', () => {
        showDebug('🎯 ТРИГГЕР НАЙДЕН!');
        isTracking = true;
        
        document.getElementById('tracking-hint').classList.add('hidden');
        
        videoElement.play().then(() => {
            showDebug('▶️ Видео играет!');
        }).catch(err => {
            showDebug(`❌ Видео ошибка: ${err.message}`, true);
        });
    });
    
    targetEntity.addEventListener('targetLost', () => {
        showDebug('❌ Триггер потерян');
        isTracking = false;
        
        document.getElementById('tracking-hint').classList.remove('hidden');
        videoElement.pause();
    });
    
    showDebug('✅ Трекинг настроен');
}

// ============================================
// ПЕРЕКЛЮЧЕНИЕ ЗВУКА
// ============================================
function toggleSound() {
    const btn = document.getElementById('toggle-sound');
    
    if (isSoundEnabled) {
        videoElement.muted = true;
        btn.textContent = '🔇 Звук ВЫКЛ';
        isSoundEnabled = false;
        showDebug('🔇 Звук выключен');
    } else {
        videoElement.muted = false;
        btn.textContent = '🔊 Звук ВКЛ';
        isSoundEnabled = true;
        showDebug('🔊 Звук включен');
        
        if (isTracking && videoElement.paused) {
            videoElement.play();
        }
    }
}

// ============================================
// ПОКАЗАТЬ ОШИБКУ
// ============================================
function showError(message) {
    const startScreen = document.getElementById('start-screen');
    const content = startScreen.querySelector('.overlay-content');
    
    content.innerHTML = `
        <h2>❌ Ошибка</h2>
        <p>${message}</p>
        <button onclick="location.reload()" class="btn-primary">Перезагрузить</button>
    `;
    
    startScreen.classList.remove('hidden');
}
