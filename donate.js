;(function(){
  /**
   * ============================================
   *  DONATION PAGE SCRIPT (plain JS, no backend)
   * ============================================
   *
   * WHAT THIS DOES:
   *  - Draws a progress bar: "$RAISED of $GOAL — XX%"
   *  - Lets the donor pick a quick amount or type a custom amount
   *  - Wires the chosen amount into the PayPal Standard form
   *  - Test mode (SANDBOX) by adding "&sandbox=1" to the page URL
   *
   * HOW TO MANUALLY CHANGE THE "RAISED" TOTAL (no server):
   *  Option A) Edit the numbers in the *page URL*:
   *     ?raised=3250&goal=10000
   *
   *  Option B) Edit the defaults *right below* (DEFAULT_RAISED / DEFAULT_GOAL).
   *     - These are used only if the URL doesn't specify raised/goal.
   *
   * CONNECTING TO YOUR PAYPAL:
   *  1) Open donate.html and change the hidden input:
   *       <input name="business" value="YOUR-PAYPAL-MERCHANT-EMAIL@example.com">
   *     to your PayPal Business email (live or sandbox).
   *
   *  2) To test without real money, add "&sandbox=1" to the URL. Example:
   *       donate.html?raised=3250&goal=10000&sandbox=1
   *     Then use your Sandbox Personal account to "pay" on sandbox.paypal.com.
   *
   *  3) When you go live, remove "&sandbox=1" and make sure "business" is your real PayPal email.
   */

  // ---- Edit these if you want a fixed default shown when URL has no numbers ----
  const DEFAULT_GOAL   = 5000;  // <-- change this if you want a different default goal
  const DEFAULT_RAISED = 0;     // <-- change this if you want a different default raised

  // Small helper
  function $(id){ return document.getElementById(id); }
  function money(n){ return Number(n || 0).toLocaleString('en-US', { style:'currency', currency:'USD' }); }

  // Read optional numbers from the URL (e.g. ?raised=1234&goal=10000)
  const params = new URLSearchParams(location.search);
  const GOAL_FROM_URL   = Number(params.get('goal'));
  const RAISED_FROM_URL = Number(params.get('raised'));

  // Final numbers used by the page
  let GOAL   = Number.isFinite(GOAL_FROM_URL)   ? GOAL_FROM_URL   : DEFAULT_GOAL;
  let raised = Number.isFinite(RAISED_FROM_URL) ? RAISED_FROM_URL : DEFAULT_RAISED;

  // Grab the elements we update
  const raisedText  = $('raisedText');
  const goalText    = $('goalText');
  const percentText = $('percentText');
  const fill        = $('progressFill');

  // If these don't exist, this script was loaded on a different page — just quit.
  if (!raisedText || !goalText || !percentText || !fill) {
    console.debug('[donate.js] Not on the donate page — skipping.');
    return;
  }

  // --- SANDBOX TOGGLE and BUSINESS OVERRIDE via URL ---
  // Add &sandbox=1 to the URL to test on sandbox.paypal.com
  // Add &business=you@example.com to override the <input name="business"> in the form
  const paypalForm = $('paypalForm');
  if (paypalForm) {
    const useSandbox = params.get('sandbox') === '1';
    if (useSandbox) {
      paypalForm.action = 'https://www.sandbox.paypal.com/cgi-bin/webscr';
      console.debug('[donate.js] Using PayPal Sandbox endpoint');
    }
    const businessParam = params.get('business');
    if (businessParam) {
      const businessField = paypalForm.querySelector('input[name="business"]');
      if (businessField) businessField.value = businessParam;
    }

    // Safety: make sure we don't submit a $0 donation
    paypalForm.addEventListener('submit', (e) => {
      const amt = Number(($('ppAmount')?.value) || 0);
      if (!Number.isFinite(amt) || amt <= 0) {
        e.preventDefault();
        alert('Please enter a valid donation amount (greater than $0).');
      }
    });
  }

  // Draw the progress bar + text
  function renderProgress(extraPreview=0){
    const current = Math.max(0, raised + extraPreview);          // preview shows raised + selected amount
    const pct = Math.min(100, (current / GOAL) * 100);           // percent toward goal, capped at 100
    raisedText.textContent  = money(current);                    // "$3,250"
    goalText.textContent    = money(GOAL);                       // "$10,000"
    percentText.textContent = (Math.round(pct * 10) / 10) + '%'; // "32.5%"
    fill.style.width = pct + '%';                                // widen the blue bar
    fill.setAttribute('aria-valuenow', pct.toFixed(1));          // a11y attribute for screen readers
  }
  renderProgress(); // Initial draw using current "raised" amount

  // --- Amount selection: preset buttons + custom input ---
  const quick    = $('quickAmounts');   // container for the preset amount buttons
  const custom   = $('customAmount');   // number input for custom amount
  const ppAmount = $('ppAmount');       // hidden field actually sent to PayPal

  // Helper to visually mark which preset button is active
  function setActive(btn){
    if (!quick) return;
    [...quick.querySelectorAll('.amount-btn')].forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
  }

  // Handle clicks on the preset amount buttons (e.g., $25, $50, ...)
  if (quick) {
    quick.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-amt]');
      if (!btn) return;
      const amt = Number(btn.dataset.amt);
      if (ppAmount) ppAmount.value = amt;       // will be submitted to PayPal
      if (custom) custom.value = '';            // clear custom so they don't conflict
      setActive(btn);
      renderProgress(amt);                      // show the preview: raised + this amount
    });
  }

  // Handle typing into the custom amount box
  if (custom) {
    custom.addEventListener('input', () => {
      const v = Math.max(0, Number(custom.value || 0));
      if (ppAmount) ppAmount.value = v || '';   // update PayPal amount
      setActive(null);                          // no preset is selected now
      renderProgress(v);                        // preview with the custom amount
    });
  }

  // Default selection: $25 (if that button exists)
  if (quick) setActive(quick.querySelector('[data-amt="25"]'));

  // NOTE: This page does not auto-increase "raised" after a real donation (no server).
  // To update the progress:
  //   - Edit the URL with ?raised=NEW_NUMBER, OR
  //   - Change DEFAULT_RAISED at the top, then reload.
})();