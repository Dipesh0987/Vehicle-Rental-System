/**
 * Mobile Filter Modal Component
 * Enhanced mobile experience with slide-out filter panel
 */

document.addEventListener("DOMContentLoaded", function () {
    window.__mobileFilterModalInitialized = true;

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
        "fixed left-0 top-0 z-40 h-screen w-full max-w-96 -translate-x-full transform border-r border-[#d4ded9] bg-white shadow-[0_20px_42px_rgba(10,31,34,0.24)] transition-transform duration-300 lg:hidden";
    mobileModal.style.maxWidth = "calc(100% - 16px)";
    document.body.appendChild(mobileModal);

    // Add close button to mobile modal
    const closeHeader = document.createElement("div");
    closeHeader.innerHTML = `
        <div class="flex items-center justify-between p-6 border-b border-[#d4ded9]">
            <h2 class="text-xl font-bold text-ink">Filters</h2>
            <button id="mobileFilterClose" class="text-muted hover:text-ink transition">
                <i class="fas fa-times text-2xl"></i>
            </button>
        </div>
    `;

    mobileModal.appendChild(closeHeader);

    // Filter content container
    const filterContent = document.createElement("div");
    filterContent.id = "mobileFilterContent";
    filterContent.className = "h-[calc(100vh-88px)] overflow-y-auto p-6";
    mobileModal.appendChild(filterContent);

    // Toggle mobile filter modal
    function toggleMobileFilter() {
        const isOpen = mobileModal.style.transform === "translateX(0)";

        if (isOpen) {
            mobileModal.style.transform = "translateX(-100%)";
            modalOverlay.classList.add("hidden");
            document.body.style.overflow = "";
        } else {
            mobileModal.style.transform = "translateX(0)";
            modalOverlay.classList.remove("hidden");
            document.body.style.overflow = "hidden";

            // Sync filter content with main panel
            if (filterPanel.innerHTML) {
                filterContent.innerHTML = filterPanel.innerHTML;
                if (window.AdvancedSearch?.uiManager?.attachFilterEventListeners) {
                    window.AdvancedSearch.uiManager.attachFilterEventListeners();
                }
            }
        }
    }

    // Event listeners
    mobileFilterBtn.addEventListener("click", toggleMobileFilter);

    document.getElementById("mobileFilterClose").addEventListener("click", toggleMobileFilter);

    modalOverlay.addEventListener("click", toggleMobileFilter);

    // Close on escape key
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && mobileModal.style.transform === "translateX(0)") {
            toggleMobileFilter();
        }
    });

});
