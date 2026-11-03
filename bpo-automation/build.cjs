// Builds the importable n8n workflow from src/*.js.  Usage: node bpo-automation/build.cjs
const fs = require('fs');
const path = require('path');

const src = (name) => {
  const code = fs.readFileSync(path.join(__dirname, 'src', name), 'utf8');
  // Syntax check: n8n runs Code node source inside an async function.
  new Function(`return (async function () {\n${code}\n})`);
  return code;
};

const codeNode = (n, name, file, position) => ({
  parameters: { jsCode: src(file) },
  id: `a1b2c3d4-000${n}-4000-8000-00000000000${n}`,
  name,
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position,
});

const workflow = {
  name: 'Freelancer Agents (customer service + won projects)',
  nodes: [
    {
      parameters: { rule: { interval: [{ field: 'minutes', minutesInterval: 2 }] } },
      id: 'a1b2c3d4-0001-4000-8000-000000000001',
      name: 'Every 2 minutes',
      type: 'n8n-nodes-base.scheduleTrigger',
      typeVersion: 1.2,
      position: [0, 100],
    },
    codeNode(2, 'Settings', 'settings.js', [240, 100]),
    codeNode(3, 'Customer Service Assistant', 'cs-agent.js', [500, 0]),
    codeNode(4, 'Won Projects → Upwork Post', 'won-projects.js', [500, 200]),
  ],
  connections: {
    'Every 2 minutes': { main: [[{ node: 'Settings', type: 'main', index: 0 }]] },
    Settings: {
      main: [[
        { node: 'Customer Service Assistant', type: 'main', index: 0 },
        { node: 'Won Projects → Upwork Post', type: 'main', index: 0 },
      ]],
    },
  },
  settings: { executionOrder: 'v1' },
};

const outDir = path.join(__dirname, 'workflows');
fs.mkdirSync(outDir, { recursive: true });
fs.rmSync(path.join(outDir, 'customer-service-agent.json'), { force: true });
const out = path.join(outDir, 'freelancer-agents.json');
fs.writeFileSync(out, JSON.stringify(workflow, null, 2));
console.log('Wrote', out);
