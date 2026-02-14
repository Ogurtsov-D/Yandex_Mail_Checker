function parseUnreadCount(html) {
    try {
        // Основной метод - поиск в блоке папок
        const folderBlockMatch = html.match(/<div class="b-folders">([\s\S]*?)<\/div>/);
        if (folderBlockMatch) {
            const folderBlock = folderBlockMatch[1];
            
            // Ищем inbox и количество
            const inboxMatch = folderBlock.match(/href="\/lite\/inbox"([\s\S]*?)class="b-folders__folder__num"[^>]*>([^<]+)</);
            if (inboxMatch && inboxMatch[2]) {
                const countText = inboxMatch[2].replace(/,/g, '').trim();
                const count = parseInt(countText, 10);
                return isNaN(count) ? 0 : count;
            }
        }
        
        // Альтернативный метод - поиск по всему HTML
        const countMatch = html.match(/class="b-folders__folder__num"[^>]*>(\d+)/);
        if (countMatch && countMatch[1]) {
            return parseInt(countMatch[1], 10);
        }
        
        return 0;
    } catch (error) {
        console.error('Error parsing email count:', error);
        return -1;
    }
}