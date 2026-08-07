import fs from 'fs';

let body = fs.readFileSync('_extract/body.html', 'utf8');
body = body.replace(/onclick="switchLbTab\('local'\)"/g, '');
body = body.replace(/onclick="switchLbTab\('global'\)"/g, '');
body = body.replace('id="lbTabLocal"', 'id="lbTabLocal" role="tab" aria-selected="true"');
body = body.replace('id="lbTabGlobal"', 'id="lbTabGlobal" role="tab" aria-selected="false"');

const shortModal = `
  <div id="shortOverlay" class="modal-overlay" role="dialog" aria-modal="true" style="display:none;" aria-hidden="true">
    <div class="modal" role="document" aria-labelledby="shortTitle">
      <h2 id="shortTitle">Short Sell</h2>
      <div class="headline" id="shortHeadline">—</div>
      <div class="small muted" id="shortInfo">—</div>
      <div style="display:flex;gap:8px;margin-top:12px;align-items:center;">
        <label class="small muted" for="shortShares">Shares:</label>
        <input id="shortShares" type="number" min="1" value="1" style="width:110px" />
        <div style="flex:1"></div>
        <div id="shortCost" class="small muted">Collateral: $0</div>
      </div>
      <div class="controls" style="margin-top:12px;">
        <button id="shortCancel" class="btn-secondary">Cancel</button>
        <button id="shortConfirm" class="btn-primary">Confirm Short</button>
      </div>
    </div>
  </div>
`;
body = body.replace('<!-- GLOSSARY MODAL -->', `${shortModal}\n  <!-- GLOSSARY MODAL -->`);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mini Market Simulation</title>
</head>
<body>
${body}
  <script type="module" src="/src/main.js"></script>
</body>
</html>
`;

fs.writeFileSync('index.html', html, 'utf8');
console.log('index.html written', html.length);
