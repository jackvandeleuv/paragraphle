export const winModal = () => {
    return `
        <div
            id="winModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="winModalTitle"
            aria-describedby="winModalDesc"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
            style="display: none"
        >
            <div
            class="relative w-full max-w-sm origin-center rounded-xl 
            bg-gradient-to-br from-red-500/60 to-red-600/60 text-neutral-50 
            shadow-2xl ring-1 ring-white/15
            animate-[fadeIn_0.25s_ease,scaleIn_0.25s_ease]"
            >
            <button
                type="button"
                aria-label="Close dialog"
                class="absolute top-2.5 right-2.5 inline-flex h-9 w-9 items-center justify-center rounded-md
                    text-sky-50/80 hover:text-white hover:bg-white/10 focus:outline-none
                    focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-sky-600
                    transition"
            >
                <span class="relative block h-4 w-4">
                <span class="absolute inset-0 h-[2px] w-full bg-current rotate-45" aria-hidden="true"></span>
                <span class="absolute inset-0 h-[2px] w-full bg-current -rotate-45" aria-hidden="true"></span>
                </span>
            </button>

            <div class="px-6 pt-9 pb-8 text-[15px] leading-relaxed">
                <h2 class="text-2xl font-extrabold tracking-tight leading-tight mb-3">
                You got it!
                </h2>
                <img class="w-full max-w-2xl object-cover mb-4" id="winImage" alt="Image of daily article." src="../public/nonplussed-lincoln.jpg"></img>
                <p id="winModalTitle" class="mb-2 text-xl font-bold"></p>
                <p id="winModalDesc" class="text-lg text-sky-50/90">
                It took you <span id="winModalGuessCount" aria-live="polite" class="font-bold text-white"></span> guesses.
                </p>
                <p id="winModalStatsDesc" class="text-lg text-sky-50/90">
                </p>
            </div>
            </div>
        </div>
`;
}