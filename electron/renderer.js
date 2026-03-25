/* global Blockly */

(function () {
  'use strict';

  const OP_MATH_TO_BACKEND = {
    ADD: 'add',
    SUB: 'subtract',
    MUL: 'multiply',
    DIV: 'divide'
  };

  const OP_COMPARE_TO_SYMBOL = {
    GT: '>',
    LT: '<',
    EQ: '==',
    GTE: '>=',
    LTE: '<='
  };

  const BLOCK_DEFS = [
    {
      type: 'smh_math',
      message0: 'math %1 %2 %3',
      args0: [
        {
          type: 'field_dropdown',
          name: 'OP',
          options: [
            ['+', 'ADD'],
            ['−', 'SUB'],
            ['×', 'MUL'],
            ['÷', 'DIV']
          ]
        },
        { type: 'field_number', name: 'A', value: 0 },
        { type: 'field_number', name: 'B', value: 0 }
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 230
    },
    {
      type: 'smh_if_else',
      message0: 'if %1 %2 %3',
      args0: [
        { type: 'field_number', name: 'LEFT', value: 0 },
        {
          type: 'field_dropdown',
          name: 'OP',
          options: [
            ['>', 'GT'],
            ['<', 'LT'],
            ['=', 'EQ'],
            ['≥', 'GTE'],
            ['≤', 'LTE']
          ]
        },
        { type: 'field_number', name: 'RIGHT', value: 0 }
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 210
    },
    {
      type: 'smh_for_loop',
      message0: 'repeat %1 times',
      args0: [
        {
          type: 'field_number',
          name: 'COUNT',
          value: 3,
          min: 1,
          max: 100,
          precision: 0
        }
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 120
    },
    {
      type: 'smh_fetch_db',
      message0: 'fetch DB %1',
      args0: [
        {
          type: 'field_input',
          name: 'QUERY',
          text: 'SELECT tag_1 FROM test_table LIMIT 1'
        }
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 290
    }
  ];

  Blockly.defineBlocksWithJsonArray(BLOCK_DEFS);

  const toolbox = {
    kind: 'flyoutToolbox',
    contents: [
      { kind: 'block', type: 'smh_math' },
      { kind: 'block', type: 'smh_if_else' },
      { kind: 'block', type: 'smh_for_loop' },
      { kind: 'block', type: 'smh_fetch_db' }
    ]
  };

  const workspace = Blockly.inject('blocklyDiv', {
    toolbox,
    media: 'node_modules/blockly/media/',
    grid: {
      spacing: 20,
      length: 3,
      colour: '#ddd',
      snap: true
    },
    trashcan: true,
    sounds: false,
    toolboxPosition: 'start'
  });

  const blocklyDiv = document.getElementById('blocklyDiv');
  if (!blocklyDiv) {
    throw new Error('Missing #blocklyDiv');
  }

  const resizeBlockly = () => {
    Blockly.svgResize(workspace);
    const flyout = workspace.getFlyout && workspace.getFlyout();
    if (flyout && typeof flyout.setVisible === 'function') {
      flyout.setVisible(true);
    }
  };

  // In Electron + flex layouts, the container height settles after inject.
  // Use ResizeObserver so the SVG always matches the container size.
  const ro = new ResizeObserver(() => resizeBlockly());
  ro.observe(blocklyDiv);

  // Also kick a few resizes after startup for reliability.
  resizeBlockly();
  requestAnimationFrame(() => resizeBlockly());
  setTimeout(() => resizeBlockly(), 250);
  setTimeout(() => {
    if (typeof workspace.updateToolbox === 'function') {
      workspace.updateToolbox(toolbox);
    }
    resizeBlockly();
  }, 0);

  const statusEl = document.getElementById('status');
  const pathsEl = document.getElementById('paths');
  const btnCompile = document.getElementById('btn-compile');
  const btnPaths = document.getElementById('btn-paths');

  const setStatus = (text) => {
    statusEl.textContent = text;
  };

  const showBlocklyDebug = () => {
    const categoryCount = 0;
    const blockCount = Array.isArray(toolbox.contents) ? toolbox.contents.length : 0;
    const toolboxDiv = document.querySelector('.blocklyToolboxDiv');
    const flyoutDiv = document.querySelector('.blocklyFlyout');
    const mainWs = Blockly.getMainWorkspace && Blockly.getMainWorkspace();
    const flyoutWs = workspace.getFlyout && workspace.getFlyout() && workspace.getFlyout().getWorkspace
      ? workspace.getFlyout().getWorkspace()
      : null;
    const flyoutBlockCount =
      flyoutWs && flyoutWs.getAllBlocks ? flyoutWs.getAllBlocks(false).length : 0;

    setStatus(
      [
        `Debug: toolbox xml categories=${categoryCount} blocks=${blockCount}`,
        `Debug: .blocklyToolboxDiv=${toolboxDiv ? 'present' : 'missing'}`,
        `Debug: .blocklyFlyout=${flyoutDiv ? 'present' : 'missing'}`,
        `Debug: mainWorkspace=${mainWs ? 'present' : 'missing'}`,
        `Debug: flyoutBlocks=${flyoutBlockCount}`
      ].join('\n')
    );
  };

  // Show a quick on-screen debug readout at startup.
  setTimeout(showBlocklyDebug, 50);

  const validateFetchQuery = (raw) => {
    const q = String(raw).trim();
    if (!q.length) {
      return 'Query is empty';
    }
    if (!/^select\s/i.test(q)) {
      return 'Only SELECT queries are allowed';
    }
    if (!/\btest_table\b/i.test(q)) {
      return 'Query must reference table test_table';
    }
    const segments = q
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
    if (segments.length > 1) {
      return 'Only one SQL statement allowed';
    }
    return null;
  };

  const collectChain = (topBlock) => {
    const list = [];
    let b = topBlock;
    while (b) {
      list.push(b);
      b = b.getNextBlock();
    }
    return list;
  };

  const serializeBlock = (block, orderIndex) => {
    const block_id = block.id;
    switch (block.type) {
      case 'smh_math': {
        const opKey = block.getFieldValue('OP');
        return {
          block_id,
          block_type: 'math',
          params: {
            op: OP_MATH_TO_BACKEND[opKey],
            a: Number(block.getFieldValue('A')),
            b: Number(block.getFieldValue('B'))
          },
          order_index: orderIndex
        };
      }
      case 'smh_if_else': {
        const cmp = block.getFieldValue('OP');
        return {
          block_id,
          block_type: 'if_else',
          params: {
            left: Number(block.getFieldValue('LEFT')),
            operator: OP_COMPARE_TO_SYMBOL[cmp],
            right: Number(block.getFieldValue('RIGHT'))
          },
          order_index: orderIndex
        };
      }
      case 'smh_for_loop': {
        return {
          block_id,
          block_type: 'for_loop',
          params: {
            count: Math.floor(Number(block.getFieldValue('COUNT')))
          },
          order_index: orderIndex
        };
      }
      case 'smh_fetch_db': {
        return {
          block_id,
          block_type: 'fetch_db',
          params: {
            query: String(block.getFieldValue('QUERY')).trim()
          },
          order_index: orderIndex
        };
      }
      default:
        return {
          block_id,
          block_type: 'unknown',
          params: { blocklyType: block.type },
          order_index: orderIndex
        };
    }
  };

  const buildRowsFromWorkspace = () => {
    const tops = workspace.getTopBlocks(true);
    const rows = [];
    let orderIndex = 1;
    for (let i = 0; i < tops.length; i++) {
      const chain = collectChain(tops[i]);
      for (let j = 0; j < chain.length; j++) {
        rows.push(serializeBlock(chain[j], orderIndex));
        orderIndex += 1;
      }
    }
    return rows;
  };

  const validateRows = (rows) => {
    const errors = [];
    for (const row of rows) {
      if (row.block_type === 'unknown') {
        errors.push(`Block ${row.block_id}: unsupported block type`);
        continue;
      }
      if (row.block_type === 'math') {
        const { op, a, b } = row.params;
        if (!op || Number.isNaN(a) || Number.isNaN(b)) {
          errors.push(`Block ${row.block_id}: invalid math fields`);
        }
        if (op === 'divide' && Number(b) === 0) {
          errors.push(`Block ${row.block_id}: divide by zero`);
        }
      }
      if (row.block_type === 'if_else') {
        const { left, right, operator } = row.params;
        if (Number.isNaN(left) || Number.isNaN(right) || !operator) {
          errors.push(`Block ${row.block_id}: invalid if/else fields`);
        }
      }
      if (row.block_type === 'for_loop') {
        const c = row.params.count;
        if (!Number.isFinite(c) || c < 1 || c > 100) {
          errors.push(`Block ${row.block_id}: repeat count must be 1–100`);
        }
      }
      if (row.block_type === 'fetch_db') {
        const msg = validateFetchQuery(row.params.query);
        if (msg) {
          errors.push(`Block ${row.block_id} (fetch DB): ${msg}`);
        }
      }
    }
    return errors;
  };

  btnCompile.addEventListener('click', async () => {
    setStatus('Compiling…');
    const rows = buildRowsFromWorkspace();
    if (rows.length === 0) {
      setStatus('Nothing to compile — add blocks to the workspace.');
      return;
    }
    const errors = validateRows(rows);
    if (errors.length > 0) {
      setStatus(`Compile failed:\n${errors.join('\n')}`);
      return;
    }
    try {
      const result = await window.electronAPI.saveCompiledCsv(rows);
      setStatus(`Saved ${rows.length} row(s) to:\n${result.filePath}`);
    } catch (e) {
      setStatus(`Save failed: ${e && e.message ? e.message : String(e)}`);
    }
  });

  const showPaths = async () => {
    const paths = await window.electronAPI.getPaths();
    pathsEl.textContent = JSON.stringify(paths, null, 2);
  };

  btnPaths.addEventListener('click', showPaths);
  showPaths();

  window.addEventListener('resize', () => {
    Blockly.svgResize(workspace);
  });
})();
