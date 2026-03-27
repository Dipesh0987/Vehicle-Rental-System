/**
 * Mobile Filter Modal Component
 * Enhanced mobile experience with slide-out filter panel
 */

document.addEventListener("DOMContentLoaded", function () {
    const mobileFilterBtn = document.getElementById("mobileFilterBtn");
    const filterPanel = document.getElementById("filterPanel");

    if (!mobileFilterBtn || !filterPanel) return;

    // Create mobile modal container
    const modalOverlay = document.createElement("div");
    modalOverlay.id = "filterModalOverlay";
    modalOverlay.className = "fixed inset-0 bg-black/50 z-30 hidden lg:hidden";
    document.body.appendChild(modalOverlay);

    // Create mobile modal panel
    const mobileModal = document.createElement("div");
    mobileModal.id = "filterModalPanel";
    mobileModal.className =
        "fixed left-0 top-0 w-full max-w-96 h-screen bg-white z-40 transform -translate-x-full transition-transform duration-300 lg:hidden";
    mobileModal.style.maxWidth = "calc(100% - 16px)";
    document.body.appendChild(mobileModal);

    // Add close button to mobile modal
    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = `
        <div class="flex items-center justify-between p-6 border-b border-[#d4ded9]">
            <h2 class="text-xl font-bold text-ink">Filters</h2>
            <button id="mobileFilterClose" class="text-muted hover:text-ink transition">
                <i class="fas fa-times text-2xl"></i>
            </button>
        </div>
    `;

    mobileModal.appendChild(closeBtn);

    // Filter content container
    const filterContent = document.createElement("div");
    filterContent.id = "mobileFilterContent";
    filterContent.className = "filter-sidebar border-none rounded-none p-6 py-0 h-auto";
    mobileModal.appendChild(filterContent);

    // Toggle mobile filter modal
    function toggleMobileFilter() {
        const isOpen = mobileModal.style.transform === "translateX(0px)";

        if (isOpen) {
            mobileModal.style.transform = "translateX(-100%)";
            modalOverlay.classList.add("hidden");
        } else {
            mobileModal.style.transform = "translateX(0)";
            modalOverlay.classList.remove("hidden");

            // Sync filter content with main panel
            if (filterPanel.innerHTML) {
                filterContent.innerHTML = filterPanel.innerHTML;
            }
        }
    }

    // Event listeners
    mobileFilterBtn.addEventListener("click", toggleMobileFilter);

    document.getElementById("mobileFilterClose").addEventListener("click", toggleMobileFilter);

    modalOverlay.addEventListener("click", toggleMobileFilter);

    // Close on escape key
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && mobileModal.style.transform === "translateX(0px)") {
            toggleMobileFilter();
        }
    });

    // Prevent body scroll when modal is open
    const originalToggle = toggleMobileFilter;
    window.toggleMobileFilter = function () {
        originalToggle();
        if (mobileModal.style.transform === "translateX(0px)") {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
    };

    mobileFilterBtn.addEventListener("click", window.toggleMobileFilter);
    document.getElementById("mobileFilterClose").addEventListener("click", window.toggleMobileFilter);
    modalOverlay.addEventListener("click", window.toggleMobileFilter);
});
