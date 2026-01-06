// ============================================
// ОСНОВНАЯ ЛОГИКА AR-ОТКРЫТОК
// ============================================

let currentCard = null;
let arScene = null;
let videoElement = null;
let isSoundEnabled = false;
let isTracking = false;

// ============================================
// ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ СТРАНИЦЫ
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Получаем ID открытки из URL
    const urlParams = new URLSearchParams(window.location.search);
    const cardId = urlParams.get('id');
    
    // Если ID не указан - показываем экран выбора
    if (!cardId) {
        showCardSelection();
        return;
    }
    
    // Проверяем существование открытки
    if (!CARDS[cardId]) {
        showError(`Открытка "${cardId}" не найдена`);
        return;
    }
    
    currentCard = CARDS[cardId];
    
    // Показываем название на стартовом экране
    document.getElementById('card-title').textContent = currentCard.title;
    
    // Инициализируем элементы
    arScene = document.getElementById('ar-scene');
    videoElement = document.getElementById('ar-video');
    
    // Кнопка "Запустить"
    document.getElementById('start-button').addEventListener('click', startARExperience);
    
    // Кнопка повтора при ошибке камеры
    document.getElementById('retry-camera').addEventListener('click', startARExperience);
    
    // Кнопка переключения звука
    document.getElementById('toggle-sound').addEventListener('click', toggleSound);
});

// ============================================
// ПОКАЗАТЬ ЭКРАН ВЫБОРА ОТКРЫТКИ
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
// ЗАПУСК AR-ОПЫТА
// ============================================
async function startARExperience() {
    const startScreen = document.getElementById('start-screen');
    const cameraError = document.getElementById('camera-error');
    
    try {
        // 1. Устанавливаем пути к ресурсам
        arScene.setAttribute('mindar-image', `imageTargetSrc: ${currentCard.mindUrl}; autoStart: false;`);
        videoElement.src = currentCard.videoUrl;
        
        // 2. Просто загружаем видео без ожидания
        videoElement.load();
        console.log('Видео начало загружаться');
        
        // 3. Сразу скрываем стартовый экран и показываем AR
        startScreen.classList.add('hidden');
        arScene.classList.remove('hidden');
        
        // 4. Показываем подсказку и управление звуком
        document.getElementById('tracking-hint').classList.remove('hidden');
        document.getElementById('sound-control').classList.remove('hidden');
        
        // 5. Запрашиваем камеру и запускаем AR
        await requestCameraAndStartAR();
        
        // 6. Настраиваем отслеживание триггера
        setupTracking();
        
    } catch (error) {
        console.error('Ошибка запуска AR:', error);
        
        // Проверяем тип ошибки
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            // Ошибка доступа к камере
            startScreen.classList.add('hidden');
            cameraError.classList.remove('hidden');
        } else {
            // Другая ошибка
            showError(`Ошибка: ${error.message}`);
        }
    }
}

// ============================================
// ПРЕДЗАГРУЗКА ВИДЕО
// ============================================
function preloadVideo() {
    return new Promise((resolve, reject) => {
        // Если видео уже имеет данные - сразу резолвим
        if (videoElement.readyState >= 2) {
            console.log('Видео уже загружено');
            resolve();
            return;
        }
        
        const onLoaded = () => {
            console.log('Видео загружено, readyState:', videoElement.readyState);
            cleanup();
            resolve();
        };
        
        const onError = (e) => {
            console.error('Ошибка загрузки видео:', e);
            cleanup();
            reject(new Error('Ошибка загрузки видео'));
        };
        
        const onTimeout = () => {
            console.error('Таймаут загрузки видео');
            cleanup();
            reject(new Error('Таймаут загрузки видео'));
        };
        
        const cleanup = () => {
            videoElement.removeEventListener('loadeddata', onLoaded);
            videoElement.removeEventListener('canplay', onLoaded);
            videoElement.removeEventListener('error', onError);
            clearTimeout(timeoutId);
        };
        
        videoElement.addEventListener('loadeddata', onLoaded);
        videoElement.addEventListener('canplay', onLoaded);
        videoElement.addEventListener('error', onError);
        
        const timeoutId = setTimeout(onTimeout, 120000); // 2 минуты
        
        videoElement.load();
    });
}

// ============================================
// ЗАПРОС КАМЕРЫ И ЗАПУСК AR
// ============================================
async function requestCameraAndStartAR() {
    return new Promise((resolve, reject) => {
        const sceneEl = arScene;
        
        // Слушаем события A-Frame
        sceneEl.addEventListener('arReady', () => {
            console.log('AR готов');
            resolve();
        }, { once: true });
        
        sceneEl.addEventListener('arError', (event) => {
            console.error('AR ошибка:', event.detail);
            reject(event.detail);
        }, { once: true });
        
        // Ждём, пока система MindAR загрузится
        const checkSystem = () => {
            if (sceneEl.systems && sceneEl.systems['mindar-image-system']) {
                const mindAR = sceneEl.systems['mindar-image-system'];
                mindAR.start();
            } else {
                // Повторяем через 100мс если система ещё не готова
                setTimeout(checkSystem, 100);
            }
        };
        
        checkSystem();
    });
}

// ============================================
// НАСТРОЙКА ОТСЛЕЖИВАНИЯ ТРИГГЕРА
// ============================================
function setupTracking() {
    const targetEntity = document.getElementById('target-entity');
    
    // Когда триггер найден
    targetEntity.addEventListener('targetFound', () => {
        console.log('Триггер найден');
        isTracking = true;
        
        // Скрываем подсказку
        document.getElementById('tracking-hint').classList.add('hidden');
        
        // Запускаем видео (без звука сначала, чтобы обойти автоплей)
        videoElement.play().catch(err => {
            console.error('Ошибка воспроизведения:', err);
        });
    });
    
    // Когда триггер потерян
    targetEntity.addEventListener('targetLost', () => {
        console.log('Триггер потерян');
        isTracking = false;
        
        // Показываем подсказку
        document.getElementById('tracking-hint').classList.remove('hidden');
        
        // Ставим видео на паузу
        videoElement.pause();
    });
}

// ============================================
// ПЕРЕКЛЮЧЕНИЕ ЗВУКА
// ============================================
function toggleSound() {
    const btn = document.getElementById('toggle-sound');
    
    if (isSoundEnabled) {
        // Выключаем звук
        videoElement.muted = true;
        btn.textContent = '🔇 Звук ВЫКЛ';
        isSoundEnabled = false;
    } else {
        // Включаем звук
        videoElement.muted = false;
        btn.textContent = '🔊 Звук ВКЛ';
        isSoundEnabled = true;
        
        // Если видео не играет - запускаем
        if (isTracking && videoElement.paused) {
            videoElement.play().catch(err => {
                console.error('Ошибка воспроизведения со звуком:', err);
            });
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