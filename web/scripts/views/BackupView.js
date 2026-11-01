import { getElement } from '../utils/html.js';

/** Export and Import buttons in the top bar. A backup is one JSON file with every month. */
export class BackupView {
  /**
   * @param {object} actions
   * @param {() => void} actions.exportBackup
   * @param {(fileText: string) => void} actions.importBackup
   */
  constructor(actions) {
    const fileInput = getElement('importFileInput');

    getElement('exportButton').addEventListener('click', () => actions.exportBackup());
    getElement('importButton').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const chosenFile = fileInput.files[0];
      fileInput.value = ''; // choosing the same file again should still trigger an import
      if (chosenFile) actions.importBackup(await chosenFile.text());
    });
  }
}
