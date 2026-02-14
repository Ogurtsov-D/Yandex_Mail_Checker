document.addEventListener('DOMContentLoaded', async function() {
    const countElement = document.getElementById('count');
    const checkNowButton = document.getElementById('checkNow');
    const openMailButton = document.getElementById('openMail');

    // Функция обновления интерфейса
    function updateUI(count) {
        if (count === -1) {
            countElement.textContent = 'Ошибка';
            countElement.className = 'count error';
        } else if (count === 0) {
            countElement.textContent = 'Нет новых';
            countElement.className = 'count';
        } else {
            countElement.textContent = `${count} непрочитанных`;
            countElement.className = 'count';
        }
    }

    // Получаем текущий статус
    try {
        const result = await chrome.runtime.sendMessage({action: 'getStatus'});
        updateUI(result.unreadCount);
    } catch (error) {
        updateUI(-1);
    }

    // Проверить сейчас
    checkNowButton.addEventListener('click', async function() {
        const originalText = checkNowButton.textContent;
        checkNowButton.textContent = 'Проверка...';
        checkNowButton.disabled = true;
        
        try {
            await chrome.runtime.sendMessage({action: 'checkNow'});
            
            // Ждем немного и обновляем статус
            setTimeout(async () => {
                try {
                    const result = await chrome.runtime.sendMessage({action: 'getStatus'});
                    updateUI(result.unreadCount);
                } catch (error) {
                    updateUI(-1);
                } finally {
                    checkNowButton.textContent = originalText;
                    checkNowButton.disabled = false;
                }
            }, 1500);
        } catch (error) {
            checkNowButton.textContent = originalText;
            checkNowButton.disabled = false;
            updateUI(-1);
        }
    });

    // Открыть почту
    openMailButton.addEventListener('click', function() {
        chrome.tabs.create({url: 'https://mail.yandex.ru'});
    });
});