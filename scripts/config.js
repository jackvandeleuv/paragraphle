// export const URI = 'https://api.paragraphle.com';
export const URI = 'http://localhost:8000';

export const acceptedKeys = new Set();
for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i);
    acceptedKeys.add(letter);
}

export const WHITELIST_KEYS = [
    'Enter', 'Backspace', '.',
    ',', ':', '-',
    ' ', `'`, `"`,
    '(', ')', '+',
    '-', '_', '1',
    '2', '3', '4',
    '5', '6', '7', 
    '8', '9', '0',
    '?', '!', ';'
];
for (const key of WHITELIST_KEYS) {
    acceptedKeys.add(key)
}

export const LOADING_CLASS = 'animate-[loadingBox_0.5s_linear_infinite_alternate]';

