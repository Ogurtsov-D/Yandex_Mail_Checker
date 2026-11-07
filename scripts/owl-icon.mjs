// Иконка расширения для магазинов и страницы расширений: филин-почтальон в фуражке сидит на конверте
// со счётчиком писем. Рисуется кодом из простых фигур, как и значок на панели (scripts/render-icons.mjs).
// Поле 128×128. Значок на панели и в уведомлениях остаётся конвертом.

const C = {
    feather: '#6B3E26',
    featherDark: '#4A2716',
    featherLine: '#8A5534',
    disc: '#F3D7AE',
    belly: '#EBCB9C',
    envelope: '#FFC550',
    flap: '#FF5B10',
    iris: '#FF9A1F',
    pupil: '#2B1A10',
    counter: '#D14836',
    // Фуражка жёлтая (чуть золотистее конверта), околыш оранжевый, козырёк в цвет перьев — без синего
    // и без ремешка с пуговицами, чтобы не напоминать полицейскую
    cap: '#F2B229',
    capTop: '#FFCC4D',
    capShade: '#C88A10',
    capLight: '#FFE6A0',
    capLine: '#5A3410',
    visor: '#4A2716',
    cockade: '#FFFFFF',
    cockadeLine: '#C88A10'
};

const f2 = (n) => n.toFixed(2);

// Кружок-счётчик с цифрой 3 (цифра — линия, а не текст)
function counter(cx, cy, r) {
    const s = r / 7;
    const p = (dx, dy) => `${f2(cx + dx * s)} ${f2(cy + dy * s)}`;
    return (
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.counter}" stroke="#fff" stroke-width="${f2(1.5 * s)}"/>` +
        `<path d="M${p(-2.2, -3.2)} H${f2(cx + 1.9 * s)} L${p(-0.3, -0.6)} A${f2(2.35 * s)} ${f2(2.35 * s)} 0 1 1 ${p(-2.4, 3.1)}" ` +
        `fill="none" stroke="#fff" stroke-width="${f2(1.7 * s)}" stroke-linecap="round" stroke-linejoin="round"/>`
    );
}

function envelope(x, y, w, h, rx = 8) {
    const tip = y + h * 0.6;
    return (
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${C.envelope}"/>` +
        `<path d="M${x + rx} ${y} H${x + w - rx} A${rx} ${rx} 0 0 1 ${x + w} ${y + rx} V${y + rx + 1} L${x + w / 2 + 3} ${tip} ` +
        `Q${x + w / 2} ${tip + 2.5} ${x + w / 2 - 3} ${tip} L${x} ${y + rx + 1} V${y + rx} A${rx} ${rx} 0 0 1 ${x + rx} ${y} Z" fill="${C.flap}"/>`
    );
}

function eye(cx, cy, r, look) {
    return (
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff"/>` +
        `<circle cx="${cx + look}" cy="${cy + 0.6}" r="${f2(r * 0.62)}" fill="${C.iris}"/>` +
        `<circle cx="${cx + look}" cy="${cy + 0.6}" r="${f2(r * 0.36)}" fill="${C.pupil}"/>` +
        `<circle cx="${f2(cx + look + r * 0.18)}" cy="${f2(cy - r * 0.12)}" r="${f2(r * 0.13)}" fill="#fff"/>`
    );
}

// Лапа: три коротких пальца перекинуты через край конверта, на кончиках — коготки
function foot(x, y) {
    return [-4.2, 0, 4.2]
        .map(
            (dx) =>
                `<rect x="${f2(x + dx - 1.9)}" y="${y - 2.5}" width="3.8" height="7" rx="1.9" fill="${C.disc}" stroke="${C.featherDark}" stroke-width="0.7"/>` +
                `<path d="M${f2(x + dx - 0.9)} ${f2(y + 4.2)} q0.9 2 2.2 0.6" fill="none" stroke="${C.pupil}" stroke-width="1.3" stroke-linecap="round"/>`
        )
        .join('');
}

function owl(cx = 64, top = 14) {
    // Перья-«ушки» выходят из-под фуражки по бокам
    const tufts =
        `<path d="M${cx - 14} 27 Q${cx - 23} 22.5 ${cx - 30.5} 13.5 Q${cx - 21} 16 ${cx - 11} 20 Z" fill="${C.featherDark}"/>` +
        `<path d="M${cx + 14} 27 Q${cx + 23} 22.5 ${cx + 30.5} 13.5 Q${cx + 21} 16 ${cx + 11} 20 Z" fill="${C.featherDark}"/>`;
    const body =
        `<path d="M${cx} ${top} C${cx + 20} ${top} ${cx + 27} ${top + 18} ${cx + 27} ${top + 32} C${cx + 27} ${top + 46} ${cx + 18} ${top + 54} ${cx} ${top + 54} ` +
        `C${cx - 18} ${top + 54} ${cx - 27} ${top + 46} ${cx - 27} ${top + 32} C${cx - 27} ${top + 18} ${cx - 20} ${top} ${cx} ${top} Z" fill="${C.feather}"/>`;
    const wings =
        `<path d="M${cx - 25} ${top + 26} Q${cx - 34} ${top + 42} ${cx - 21} ${top + 54} Q${cx - 17} ${top + 38} ${cx - 25} ${top + 26} Z" fill="${C.featherDark}"/>` +
        `<path d="M${cx + 25} ${top + 26} Q${cx + 34} ${top + 42} ${cx + 21} ${top + 54} Q${cx + 17} ${top + 38} ${cx + 25} ${top + 26} Z" fill="${C.featherDark}"/>`;
    const chevrons = [
        [-5, 36],
        [5, 36],
        [0, 41],
        [-5, 46],
        [5, 46]
    ]
        .map(
            ([dx, dy]) =>
                `<path d="M${f2(cx + dx - 2.6)} ${top + dy} l2.6 2.6 l2.6 -2.6" fill="none" stroke="${C.featherLine}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`
        )
        .join('');
    return (
        tufts +
        body +
        wings +
        `<ellipse cx="${cx}" cy="${top + 41}" rx="13" ry="12" fill="${C.belly}"/>` +
        chevrons +
        `<circle cx="${cx - 10}" cy="${top + 21}" r="11" fill="${C.disc}"/><circle cx="${cx + 10}" cy="${top + 21}" r="11" fill="${C.disc}"/>` +
        eye(cx - 10, top + 21, 7.5, 0.8) +
        eye(cx + 10, top + 21, 7.5, -0.8) +
        `<path d="M${f2(cx - 3.5)} ${top + 28} H${f2(cx + 3.5)} L${cx} ${top + 35} Z" fill="${C.flap}"/>`
    );
}

// «@» фигурой, а не шрифтом: внешнее кольцо ровно вокруг (cx, cy), поэтому знак точно по центру кокарды
function atSign(cx, cy, s, color) {
    const R = 2.65 * s;
    const r = 1.1 * s;
    const w = 0.8 * s;
    const ic = cx - 0.15 * s;
    const xs = ic + r;
    const rad = (deg) => (deg * Math.PI) / 180;
    const po = [cx + R * Math.cos(rad(15)), cy + R * Math.sin(rad(15))];
    const pe = [cx + R * Math.cos(rad(50)), cy + R * Math.sin(rad(50))];
    const c2 = [po[0] - 0.259 * 0.8 * s, po[1] + 0.966 * 0.8 * s];
    return (
        `<circle cx="${f2(ic)}" cy="${f2(cy)}" r="${f2(r)}" fill="none" stroke="${color}" stroke-width="${f2(w)}"/>` +
        `<path d="M${f2(xs)} ${f2(cy - r - 0.15 * s)} L${f2(xs)} ${f2(cy + 0.55 * s)} C${f2(xs)} ${f2(cy + 1.15 * s)} ${f2(c2[0])} ${f2(c2[1])} ${f2(po[0])} ${f2(po[1])} ` +
        `A${f2(R)} ${f2(R)} 0 1 0 ${f2(pe[0])} ${f2(pe[1])}" fill="none" stroke="${color}" stroke-width="${f2(w)}" stroke-linecap="round" stroke-linejoin="round"/>`
    );
}

// Фуражка почтальона: широкая жёлтая тулья с приподнятым передом, оранжевый околыш,
// коричневый козырёк с бликом, кокарда «@»
function cap(cx = 64) {
    const bl = cx - 19;
    const br = cx + 19;
    const bandTop = 16.6;
    const bandBot = 21.4;
    const sag = 3.0;
    const crown =
        `M${bl} ${bandTop} C${bl - 3} ${bandTop - 1.4} ${cx - 27} 12.4 ${f2(cx - 27.6)} 10.2 ` +
        `C${f2(cx - 28.2)} 7.6 ${f2(cx - 25.6)} 6.3 ${cx - 21} 5.3 C${cx - 14} 3.8 ${cx - 7} 2.4 ${cx} 2.4 ` +
        `C${cx + 7} 2.4 ${cx + 14} 3.8 ${cx + 21} 5.3 C${f2(cx + 25.6)} 6.3 ${f2(cx + 28.2)} 7.6 ${f2(cx + 27.6)} 10.2 ` +
        `C${cx + 27} 12.4 ${br + 3} ${bandTop - 1.4} ${br} ${bandTop} Q${cx} ${bandTop + sag} ${bl} ${bandTop} Z`;
    const topEdge =
        `M${f2(cx - 27.6)} 10.2 C${f2(cx - 28.2)} 7.6 ${f2(cx - 25.6)} 6.3 ${cx - 21} 5.3 C${cx - 14} 3.8 ${cx - 7} 2.4 ${cx} 2.4 ` +
        `C${cx + 7} 2.4 ${cx + 14} 3.8 ${cx + 21} 5.3 C${f2(cx + 25.6)} 6.3 ${f2(cx + 28.2)} 7.6 ${f2(cx + 27.6)} 10.2 ` +
        `C${cx + 26} 8.6 ${cx + 14} 6.0 ${cx} 5.4 C${cx - 14} 6.0 ${cx - 26} 8.6 ${f2(cx - 27.6)} 10.2 Z`;
    const shade = (sgn, corner) =>
        `M${f2(cx + sgn * 27.6)} 10.2 Q${cx + sgn * 21} 11.6 ${cx + sgn * 14} 12.6 L${corner - sgn} ${f2(bandTop + 0.5)} ` +
        `C${corner + sgn * 3} ${f2(bandTop - 1.4)} ${cx + sgn * 27} 12.4 ${f2(cx + sgn * 27.6)} 10.2 Z`;
    const arc = (y) => `Q${cx} ${f2(y + sag)} ${br} ${f2(y)}`;
    const band = `M${bl} ${bandTop} ${arc(bandTop)} L${br} ${bandBot} Q${cx} ${f2(bandBot + sag)} ${bl} ${bandBot} Z`;
    const visor =
        `M${f2(bl - 0.6)} ${f2(bandBot - 0.4)} Q${cx} ${f2(bandBot + sag - 0.4)} ${f2(br + 0.6)} ${f2(bandBot - 0.4)} ` +
        `C${br} ${f2(bandBot + 3.2)} ${cx + 10} ${f2(bandBot + 6.4)} ${cx} ${f2(bandBot + 6.4)} ` +
        `C${cx - 10} ${f2(bandBot + 6.4)} ${bl} ${f2(bandBot + 3.2)} ${f2(bl - 0.6)} ${f2(bandBot - 0.4)} Z`;
    const vy = bandBot + 0.2;
    return (
        `<path d="${crown}" fill="${C.cap}"/>` +
        `<path d="${topEdge}" fill="${C.capTop}"/>` +
        `<path d="M${f2(cx - 26.8)} 10 C${cx - 25} 8.9 ${cx - 14} 6.7 ${cx} 6.2 C${cx + 14} 6.7 ${cx + 25} 8.9 ${f2(cx + 26.8)} 10" fill="none" stroke="${C.capLine}" stroke-width="0.6" opacity="0.7"/>` +
        `<path d="M${cx - 16} 4.9 C${cx - 9} 3.6 ${cx + 9} 3.6 ${cx + 16} 4.9" fill="none" stroke="${C.capLight}" stroke-width="1" stroke-linecap="round" opacity="0.9"/>` +
        `<path d="${shade(-1, bl)}" fill="${C.capShade}"/><path d="${shade(1, br)}" fill="${C.capShade}"/>` +
        `<path d="${band}" fill="${C.flap}"/>` +
        `<path d="M${bl} ${bandTop} ${arc(bandTop)}" fill="none" stroke="${C.capLine}" stroke-width="0.8"/>` +
        `<path d="${visor}" fill="${C.visor}"/>` +
        `<path d="M${cx - 11} ${f2(vy + 3.3)} Q${cx} ${f2(vy + 5)} ${cx + 11} ${f2(vy + 3.3)}" fill="none" stroke="#fff" stroke-width="0.9" stroke-linecap="round" opacity="0.35"/>` +
        `<circle cx="${cx}" cy="11.6" r="4.3" fill="${C.cockade}" stroke="${C.cockadeLine}" stroke-width="0.6"/>` +
        atSign(cx, 11.6, 0.97, C.capLine)
    );
}

// Мягкое светлое свечение вокруг филина над конвертом: отделяет тёмные перья и фуражку от тёмного фона
// (тёмная тема магазина, страница расширений), на светлом фоне почти не видно
const HALO =
    '<filter id="halo" x="-10%" y="-10%" width="120%" height="120%">' +
    '<feMorphology in="SourceAlpha" operator="dilate" radius="1.4" result="d"/>' +
    '<feGaussianBlur in="d" stdDeviation="0.9" result="b"/>' +
    '<feFlood flood-color="#ffffff" flood-opacity="0.4"/><feComposite in2="b" operator="in"/></filter>' +
    '<clipPath id="above-envelope"><rect x="0" y="0" width="128" height="66.5"/></clipPath>';

export function owlIconSvg() {
    return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs>${HALO}</defs>` +
        envelope(8, 66, 112, 58) +
        `<g clip-path="url(#above-envelope)"><g filter="url(#halo)">${owl()}${cap()}</g></g>` +
        owl() +
        cap() +
        foot(55, 68) +
        foot(73, 68) +
        counter(104, 106, 18) +
        '</svg>\n'
    );
}
