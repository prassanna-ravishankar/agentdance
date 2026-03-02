describe('AgentDance smoke', () => {
  before(async () => {
    await browser.url('tauri://localhost');
  });

  it('shows the spawn button', async () => {
    const btn = await $('[data-testid="spawn-open-btn"]');
    await expect(btn).toBeDisplayed();
  });

  it('opens the spawn modal', async () => {
    await $('[data-testid="spawn-open-btn"]').click();
    const modal = await $('[data-testid="spawn-modal"]');
    await expect(modal).toBeDisplayed();
    await expect($('[data-testid="spawn-directory-input"]')).toBeDisplayed();
  });

  it('closes the spawn modal', async () => {
    const closeBtn = await $('[data-testid="spawn-modal"] button:first-of-type');
    await closeBtn.click();
    await expect($('[data-testid="spawn-modal"]')).not.toBeDisplayed();
  });
});
