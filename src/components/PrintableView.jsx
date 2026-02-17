import { getSetQuestions } from '../data/sets';
import questions from '../data/questions';

// Opens a new tab with the printable answer sheet and triggers print
export const openPrintableSheet = (selectedSet) => {
  const setQuestions = getSetQuestions(selectedSet, questions);

  // Split into two columns
  const leftColumn = setQuestions.slice(0, 30);
  const rightColumn = setQuestions.slice(30, 60);

  // Generate question HTML with data attributes for master key
  const generateQuestionHTML = (q, num) => `
    <div class="question">
      <span class="num">${num}.</span>
      <div class="choices">
        ${q.choices.map((choice, i) => `<span class="choice" data-correct="${i === q.targetIdx ? '1' : '0'}">&#9744; ${choice}</span>`).join('')}
      </div>
    </div>
  `;

  // Build the full HTML document
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Phonics Competition - Set ${selectedSet}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    @page {
      size: A4;
      margin: 6mm 8mm;
    }

    html, body {
      width: 210mm;
      height: 297mm;
      font-family: Arial, sans-serif;
      background: white;
      color: black;
    }

    .container {
      width: 100%;
      height: 100%;
      padding: 4mm 6mm;
      display: flex;
      flex-direction: column;
    }

    /* No-print toolbar */
    .no-print {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #f8f9fa;
      border-bottom: 2px solid #dee2e6;
      padding: 10px 20px;
      display: flex;
      align-items: center;
      gap: 20px;
      z-index: 1000;
      font-family: Arial, sans-serif;
    }

    .no-print button {
      padding: 8px 20px;
      font-size: 14px;
      font-weight: 700;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .no-print .print-btn {
      background: #4d79ff;
      color: white;
    }

    .no-print .print-btn:hover {
      background: #3d69ef;
    }

    .no-print .toggle-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 600;
      color: #3e366b;
      cursor: pointer;
      user-select: none;
    }

    .no-print .toggle-switch {
      position: relative;
      width: 44px;
      height: 24px;
      background: #ccc;
      border-radius: 12px;
      transition: background 0.2s;
      cursor: pointer;
    }

    .no-print .toggle-switch.active {
      background: #ae90fd;
    }

    .no-print .toggle-switch::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 20px;
      height: 20px;
      background: white;
      border-radius: 50%;
      transition: transform 0.2s;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }

    .no-print .toggle-switch.active::after {
      transform: translateX(20px);
    }

    .no-print .master-key-badge {
      display: none;
      padding: 4px 10px;
      background: #ae90fd;
      color: white;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 700;
    }

    .no-print .master-key-badge.visible {
      display: inline-block;
    }

    /* Header */
    .header {
      text-align: center;
      padding-bottom: 3mm;
      border-bottom: 2px solid black;
      flex-shrink: 0;
    }

    .header h1 {
      font-size: 20px;
      font-weight: 900;
      margin-bottom: 1px;
      letter-spacing: 1px;
    }

    .header h2 {
      font-size: 26px;
      font-weight: 900;
      margin-bottom: 3mm;
    }

    .master-key-label {
      display: none;
      font-size: 14px;
      font-weight: 900;
      color: #ae90fd;
      margin-bottom: 2mm;
    }

    .fields {
      display: flex;
      justify-content: center;
      gap: 40px;
      font-size: 14px;
      font-weight: bold;
    }

    .field-line {
      display: inline-block;
      border-bottom: 2px solid black;
      min-width: 140px;
      margin-left: 6px;
    }

    .field-line.short {
      min-width: 60px;
    }

    /* Instructions */
    .instructions {
      text-align: center;
      padding: 2mm 0;
      margin: 2mm 0;
      border: 1px solid #666;
      font-size: 11px;
      flex-shrink: 0;
    }

    /* Two-column grid - takes remaining space */
    .grid {
      display: flex;
      gap: 6mm;
      flex: 1;
      min-height: 0;
    }

    .column {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .column:first-child {
      border-right: 1px solid #999;
      padding-right: 5mm;
    }

    .column:last-child {
      padding-left: 5mm;
    }

    /* Questions - evenly distributed */
    .question {
      display: flex;
      align-items: center;
      flex: 1;
      border-bottom: 1px solid #ddd;
    }

    .question:last-child {
      border-bottom: none;
    }

    .num {
      font-weight: 900;
      width: 24px;
      text-align: right;
      margin-right: 8px;
      font-size: 13px;
    }

    .choices {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    .choice {
      font-weight: 700;
      font-size: 13px;
      white-space: nowrap;
    }

    /* Master key styles - applied via JS */
    .choice.correct-answer {
      font-weight: 900;
      text-decoration: underline;
    }

    /* Footer */
    .footer {
      text-align: center;
      padding-top: 2mm;
      border-top: 1px solid #999;
      font-size: 10px;
      color: #666;
      flex-shrink: 0;
    }

    @media print {
      .no-print {
        display: none !important;
      }
      html, body {
        width: 210mm;
        height: 297mm;
      }
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <!-- Toolbar - hidden when printing -->
  <div class="no-print">
    <button class="print-btn" onclick="window.print()">Print</button>
    <label class="toggle-label" onclick="toggleMasterKey()">
      <div class="toggle-switch" id="masterKeyToggle"></div>
      Teacher's Master Key
    </label>
    <span class="master-key-badge" id="masterKeyBadge">ANSWER KEY</span>
  </div>

  <div class="container" style="margin-top: 50px;">
    <div class="header">
      <h1>PHONICS COMPETITION</h1>
      <h2>SET ${selectedSet}</h2>
      <div class="master-key-label" id="masterKeyLabel">TEACHER'S ANSWER KEY</div>
      <div class="fields">
        <div>Name: <span class="field-line"></span></div>
        <div>No: <span class="field-line short"></span></div>
      </div>
    </div>

    <div class="instructions">
      <strong>Instructions:</strong> Listen carefully to each word. Mark the correct spelling.
    </div>

    <div class="grid">
      <div class="column">
        ${leftColumn.map((q, idx) => generateQuestionHTML(q, idx + 1)).join('')}
      </div>
      <div class="column">
        ${rightColumn.map((q, idx) => generateQuestionHTML(q, idx + 31)).join('')}
      </div>
    </div>

    <div class="footer">
      60 Questions &bull; 4 Minutes
    </div>
  </div>

  <script>
    var isMasterKey = false;
    var FILLED = '\\u25A0'; // ■
    var EMPTY = '\\u2610';  // ☐

    function toggleMasterKey() {
      isMasterKey = !isMasterKey;
      var toggle = document.getElementById('masterKeyToggle');
      var badge = document.getElementById('masterKeyBadge');
      var label = document.getElementById('masterKeyLabel');

      toggle.classList.toggle('active', isMasterKey);
      badge.classList.toggle('visible', isMasterKey);
      label.style.display = isMasterKey ? 'block' : 'none';

      var choices = document.querySelectorAll('.choice');
      choices.forEach(function(el) {
        var isCorrect = el.getAttribute('data-correct') === '1';
        var text = el.textContent.substring(2); // Remove checkbox + space
        if (isMasterKey && isCorrect) {
          el.innerHTML = FILLED + ' ' + text;
          el.classList.add('correct-answer');
        } else {
          el.innerHTML = EMPTY + ' ' + text;
          el.classList.remove('correct-answer');
        }
      });
    }
  </script>
</body>
</html>
  `;

  // Open new tab and write the content
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
};

export default openPrintableSheet;
