document.addEventListener('DOMContentLoaded', () => {
    // --- Mobile Navigation Toggle ---
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    const navLinks = document.querySelectorAll('#mobile-menu a');

    mobileMenuButton.addEventListener('click', () => {
        const isExpanded = mobileMenuButton.getAttribute('aria-expanded') === 'true';
        mobileMenuButton.setAttribute('aria-expanded', !isExpanded);
        mobileMenu.classList.toggle('hidden');
        // Change icon from menu to X or vice versa
        const icon = mobileMenuButton.querySelector('svg');
        if (icon) {
            if (mobileMenu.classList.contains('hidden')) {
                icon.outerHTML = lucide.createIcons().menu.toSvg();
            } else {
                icon.outerHTML = lucide.createIcons().x.toSvg();
            }
        }
        // Re-initialize Lucide icons after changing SVG
        lucide.createIcons();
    });

    // Close mobile menu when a link is clicked
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu.classList.add('hidden');
            mobileMenuButton.setAttribute('aria-expanded', 'false');
            const icon = mobileMenuButton.querySelector('svg');
            if (icon) {
                icon.outerHTML = lucide.createIcons().menu.toSvg();
                lucide.createIcons();
            }
        });
    });

    // --- Menu Category Filtering ---
    const categoryButtons = document.querySelectorAll('.category-button');
    const menuItems = document.querySelectorAll('.menu-item');
    const menuItemsContainer = document.getElementById('menu-items-container');

    const filterMenuItems = (category) => {
        menuItemsContainer.classList.add('opacity-0', 'transition-opacity', 'duration-300'); // Fade out effect

        setTimeout(() => { // Delay hiding/showing for the fade effect
            menuItems.forEach(item => {
                const itemCategory = item.getAttribute('data-category');
                if (category === 'all' || itemCategory === category) {
                    item.classList.remove('hidden');
                    item.classList.add('animate-fade-in'); // Re-apply animation for newly visible items
                } else {
                    item.classList.add('hidden');
                    item.classList.remove('animate-fade-in');
                }
            });
            menuItemsContainer.classList.remove('opacity-0'); // Fade in effect
        }, 300); // Match fade out duration
    };

    categoryButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active state from all buttons
            categoryButtons.forEach(btn => btn.removeAttribute('data-active'));
            // Add active state to the clicked button
            button.setAttribute('data-active', 'true');
            filterMenuItems(button.getAttribute('data-category'));
        });
    });

    // Set initial active category and filter
    const initialActiveButton = document.querySelector('.category-button[data-category="all"]');
    if (initialActiveButton) {
        initialActiveButton.setAttribute('data-active', 'true');
    }
    filterMenuItems('all');

    // --- Reservation Form Submission ---
    const reservationForm = document.getElementById('reservation-form');
    const reservationMessage = document.getElementById('reservation-message');

    if (reservationForm) {
        reservationForm.addEventListener('submit', (event) => {
            event.preventDefault(); // Prevent default form submission

            // Simple form validation
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const date = document.getElementById('date').value;
            const time = document.getElementById('time').value;
            const guests = document.getElementById('guests').value;

            if (!name || !email || !date || !time || !guests) {
                reservationMessage.textContent = 'Please fill in all required fields.';
                reservationMessage.classList.remove('hidden', 'text-primary-400');
                reservationMessage.classList.add('text-red-400');
                return;
            }

            reservationMessage.classList.remove('hidden', 'text-red-400', 'text-primary-400');
            reservationMessage.classList.add('text-slate-400', 'animate-pulse');
            reservationMessage.innerHTML = `<i data-lucide="loader-circle" class="w-5 h-5 inline-block animate-spin mr-2"></i> Submitting reservation...`;
            lucide.createIcons(); // Re-render icons

            // Simulate API call
            setTimeout(() => {
                const isSuccess = Math.random() > 0.2; // 80% chance of success

                reservationMessage.classList.remove('animate-pulse', 'text-slate-400');
                reservationMessage.classList.add('animate-fade-in');

                if (isSuccess) {
                    reservationMessage.innerHTML = `<i data-lucide="check-circle" class="w-5 h-5 inline-block mr-2"></i> Your reservation has been successfully placed! We look forward to seeing you.`;
                    reservationMessage.classList.remove('text-red-400');
                    reservationMessage.classList.add('text-primary-400');
                    reservationForm.reset(); // Clear form on success
                } else {
                    reservationMessage.innerHTML = `<i data-lucide="x-circle" class="w-5 h-5 inline-block mr-2"></i> Failed to place reservation. Please try again.`;
                    reservationMessage.classList.remove('text-primary-400');
                    reservationMessage.classList.add('text-red-400');
                }
                reservationMessage.classList.remove('hidden');
                lucide.createIcons(); // Re-render icons
            }, 2000); // Simulate 2-second API call
        });
    }

    // Initialize Lucide icons on page load
    lucide.createIcons();
});
