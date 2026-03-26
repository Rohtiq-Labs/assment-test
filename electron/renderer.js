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

  const VAR_OPTIONS = [
    ['x', 'x'],
    ['y', 'y'],
    ['z', 'z']
  ];

  const BLOCK_DEFS = [
    // Expressions
    {
      type: 'smh_number',
      message0: '%1',
      args0: [{ type: 'field_number', name: 'NUM', value: 0 }],
      output: 'Number',
      colour: 65
    },
    {
      type: 'smh_get_var',
      message0: 'get %1',
      args0: [
        {
          type: 'field_dropdown',
          name: 'NAME',
          options: VAR_OPTIONS
        }
      ],
      output: 'Number',
      colour: 60
    },
    {
      type: 'smh_math_expr',
      message0: '%1 %2 %3',
      args0: [
        { type: 'input_value', name: 'A', check: 'Number' },
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
        { type: 'input_value', name: 'B', check: 'Number' }
      ],
      inputsInline: true,
      output: 'Number',
      colour: 230
    },

    // Statements
    {
      type: 'smh_set_var',
      message0: 'set %1 = %2',
      args0: [
        {
          type: 'field_dropdown',
          name: 'NAME',
          options: VAR_OPTIONS
        },
        { type: 'input_value', name: 'VALUE', check: 'Number' }
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 20
    },
    {
      type: 'smh_if_else',
      message0: 'if %1 %2 %3 do %4 else %5',
      args0: [
        { type: 'input_value', name: 'LEFT', check: 'Number' },
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
        { type: 'input_value', name: 'RIGHT', check: 'Number' },
        { type: 'input_statement', name: 'DO' },
        { type: 'input_statement', name: 'ELSE' }
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 210
    },
    {
      type: 'smh_for_loop',
      message0: 'repeat %1 times do %2',
      args0: [
        {
          type: 'field_number',
          name: 'COUNT',
          value: 3,
          min: 1,
          max: 100,
          precision: 0
        },
        { type: 'input_statement', name: 'DO' }
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
      { kind: 'block', type: 'smh_set_var' },
      { kind: 'block', type: 'smh_number' },
      { kind: 'block', type: 'smh_get_var' },
      { kind: 'block', type: 'smh_math_expr' },
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
  const btnRun = document.getElementById('btn-run');
  const btnPaths = document.getElementById('btn-paths');

  const setStatus = (text) => {
    statusEl.textContent = text;
  };

  const SUCCESS_HUE = 140;
  const FAILURE_HUE = 0;
  const SKIPPED_HUE = 0;
  const SKIPPED_GREYSCALE = '#a1a1aa';
  let runIsActive = false;
  let runLogLines = [];
  let originalColoursById = new Map();

  const snapshotBlockColours = () => {
    originalColoursById = new Map();
    const blocks = typeof workspace.getAllBlocks === 'function' ? workspace.getAllBlocks(false) : [];
    for (const block of blocks) {
      try {
        if (block && block.id && typeof block.getColour === 'function') {
          originalColoursById.set(block.id, block.getColour());
        }
      } catch {
        // Best-effort only.
      }
    }
  };

  const resetBlockColours = () => {
    const blocks = typeof workspace.getAllBlocks === 'function' ? workspace.getAllBlocks(false) : [];
    for (const block of blocks) {
      try {
        const orig = originalColoursById.get(block.id);
        if (typeof orig === 'number' && typeof block.setColour === 'function') {
          block.setColour(orig);
        }
        if (typeof block.setWarningText === 'function') {
          block.setWarningText(null);
        }
      } catch {
        // Best-effort only.
      }
    }
  };

  const setButtonsDisabled = (disabled) => {
    if (btnCompile) btnCompile.disabled = disabled;
    if (btnRun) btnRun.disabled = disabled;
    if (btnPaths) btnPaths.disabled = disabled;
  };

  const appendRunLog = (line) => {
    runLogLines.push(line);
    setStatus(runLogLines.join('\n'));
  };

  const applyBlockResult = (payload) => {
    if (!payload || !payload.block_id) return;
    if (payload.noColor) {
      const messageSuffix = payload.message ? ` - ${payload.message}` : '';
      const statusWord = payload.skipped ? 'SKIP' : payload.ok ? 'OK' : 'FAIL';
      appendRunLog(`Block ${payload.block_id}: ${statusWord}${messageSuffix}`);
      return;
    }
    let block = typeof workspace.getBlockById === 'function' ? workspace.getBlockById(payload.block_id) : null;
    if (!block && typeof workspace.getAllBlocks === 'function') {
      block = workspace.getAllBlocks(false).find((b) => b && b.id === payload.block_id);
    }
    if (!block) {
      appendRunLog(`Block ${payload.block_id}: not found in current workspace (skip coloring).`);
      return;
    }

    const ok = !!payload.ok;
    const skipped = !!payload.skipped;
    const runtimeError = !!payload.runtimeError;

    if (typeof block.setColour === 'function') {
      if (skipped) {
        // Blockly accepts string colors too; prefer a neutral gray for skipped blocks.
        block.setColour(SKIPPED_GREYSCALE);
      } else {
        block.setColour(ok ? SUCCESS_HUE : FAILURE_HUE);
      }
    }

    if (typeof block.setWarningText === 'function') {
      if ((runtimeError || (!ok && !skipped)) && payload.message) block.setWarningText(String(payload.message));
      if (ok || skipped) block.setWarningText(null);
    }

    const messageSuffix = payload.message ? ` - ${payload.message}` : '';
    const statusWord = skipped ? 'SKIP' : ok ? 'OK' : 'FAIL';
    appendRunLog(`Block ${payload.block_id}: ${statusWord}${messageSuffix}`);
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

  const normalizeFetchQuery = (raw) => {
    let q = String(raw).trim();
    q = q.replace(/^fetch\s+db\s*[:;.,\s-]*/i, '');
    return q.trim();
  };

  const validateFetchQuery = (raw) => {
    const q = normalizeFetchQuery(raw);
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

  const numberLiteralExpr = (value) => ({ kind: 'number', value: Number(value) });

  const compileExpr = (exprBlock) => {
    if (!exprBlock) return numberLiteralExpr(0);

    if (exprBlock.type === 'smh_get_var') {
      return { kind: 'var', name: String(exprBlock.getFieldValue('NAME')) };
    }

    if (exprBlock.type === 'smh_math_expr') {
      const opKey = exprBlock.getFieldValue('OP');
      const aBlock = exprBlock.getInputTargetBlock('A');
      const bBlock = exprBlock.getInputTargetBlock('B');
      return {
        kind: 'binop',
        op: OP_MATH_TO_BACKEND[opKey],
        left: compileExpr(aBlock),
        right: compileExpr(bBlock)
      };
    }

    // Fallback: try a numeric field (e.g. legacy blocks or number shadow blocks).
    if (typeof exprBlock.getFieldValue === 'function') {
      const maybe = exprBlock.getFieldValue('NUM');
      if (maybe !== null && maybe !== undefined && maybe !== '') {
        return numberLiteralExpr(maybe);
      }
    }

    return numberLiteralExpr(0);
  };

  const createRow = (blockId, blockType, params, orderIndex) => ({
    block_id: String(blockId),
    block_type: String(blockType),
    params: params || {},
    order_index: orderIndex
  });

  const compileStack = (firstBlock, rows, state) => {
    let b = firstBlock;
    while (b) {
      compileStatementBlock(b, rows, state);
      b = b.getNextBlock();
    }
  };

  const compileStatementBlock = (block, rows, state) => {
    const blockId = block.id;

    if (block.type === 'smh_set_var') {
      const name = String(block.getFieldValue('NAME'));
      const valueBlock = block.getInputTargetBlock('VALUE');
      rows.push(createRow(blockId, 'set_var', { name, value: compileExpr(valueBlock) }, state.orderIndex++));
      return;
    }

    if (block.type === 'smh_fetch_db') {
      rows.push(
        createRow(
          blockId,
          'fetch_db',
          { query: normalizeFetchQuery(block.getFieldValue('QUERY')) },
          state.orderIndex++
        )
      );
      return;
    }

    if (block.type === 'smh_if_else') {
      const cmp = block.getFieldValue('OP');
      const leftBlock = block.getInputTargetBlock('LEFT');
      const rightBlock = block.getInputTargetBlock('RIGHT');
      const operator = OP_COMPARE_TO_SYMBOL[cmp];
      rows.push(
        createRow(
          blockId,
          'if_start',
          { left: compileExpr(leftBlock), operator, right: compileExpr(rightBlock) },
          state.orderIndex++
        )
      );

      const doFirst = block.getInputTargetBlock('DO');
      compileStack(doFirst, rows, state);

      rows.push(createRow(blockId, 'else_start', {}, state.orderIndex++));
      const elseFirst = block.getInputTargetBlock('ELSE');
      compileStack(elseFirst, rows, state);

      rows.push(createRow(blockId, 'if_end', {}, state.orderIndex++));
      return;
    }

    if (block.type === 'smh_for_loop') {
      const count = Math.floor(Number(block.getFieldValue('COUNT')));
      rows.push(createRow(blockId, 'loop_start', { count: numberLiteralExpr(count) }, state.orderIndex++));
      const doFirst = block.getInputTargetBlock('DO');
      compileStack(doFirst, rows, state);
      rows.push(createRow(blockId, 'loop_end', {}, state.orderIndex++));
      return;
    }

    rows.push(
      createRow(blockId, 'unknown', { blocklyType: block.type }, state.orderIndex++)
    );
  };

  const buildRowsFromWorkspace = () => {
    const tops = workspace.getTopBlocks(true);
    const rows = [];
    const state = { orderIndex: 1 };
    for (let i = 0; i < tops.length; i++) {
      compileStack(tops[i], rows, state);
    }
    return rows;
  };

  const validateExpr = (expr, errors, contextBlockId) => {
    if (!expr || typeof expr !== 'object' || !expr.kind) {
      errors.push(`Block ${contextBlockId}: invalid expression`);
      return;
    }

    if (expr.kind === 'number') {
      if (!Number.isFinite(Number(expr.value))) errors.push(`Block ${contextBlockId}: invalid number literal`);
      return;
    }

    if (expr.kind === 'var') {
      if (!expr.name || !['x', 'y', 'z'].includes(String(expr.name))) {
        errors.push(`Block ${contextBlockId}: invalid variable name`);
      }
      return;
    }

    if (expr.kind === 'binop') {
      if (!expr.op) errors.push(`Block ${contextBlockId}: invalid math op`);
      validateExpr(expr.left, errors, contextBlockId);
      validateExpr(expr.right, errors, contextBlockId);
      return;
    }

    errors.push(`Block ${contextBlockId}: unsupported expression kind ${String(expr.kind)}`);
  };

  const validateRows = (rows) => {
    const errors = [];
    for (const row of rows) {
      if (row.block_type === 'unknown') {
        errors.push(`Block ${row.block_id}: unsupported block type`);
        continue;
      }

      if (row.block_type === 'set_var') {
        const name = row.params && row.params.name;
        if (!name || !['x', 'y', 'z'].includes(String(name))) {
          errors.push(`Block ${row.block_id}: set_var must use x/y/z`);
        }
        validateExpr(row.params && row.params.value, errors, row.block_id);
      }

      if (row.block_type === 'if_start') {
        const { left, right, operator } = row.params || {};
        if (!operator) errors.push(`Block ${row.block_id}: missing if operator`);
        validateExpr(left, errors, row.block_id);
        validateExpr(right, errors, row.block_id);
      }

      if (row.block_type === 'loop_start') {
        const countExpr = row.params && row.params.count;
        validateExpr(countExpr, errors, row.block_id);
        if (countExpr && countExpr.kind === 'number') {
          const c = Math.floor(Number(countExpr.value));
          if (!Number.isFinite(c) || c < 1 || c > 100) {
            errors.push(`Block ${row.block_id}: repeat count must be 1–100`);
          }
        }
      }

      if (row.block_type === 'fetch_db') {
        const msg = validateFetchQuery(row.params && row.params.query);
        if (msg) errors.push(`Block ${row.block_id} (fetch DB): ${msg}`);
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

  if (window.electronAPI && typeof window.electronAPI.onBlockResult === 'function') {
    window.electronAPI.onBlockResult((payload) => {
      if (!runIsActive) return;
      applyBlockResult(payload);
    });
  }

  if (window.electronAPI && typeof window.electronAPI.onRunComplete === 'function') {
    window.electronAPI.onRunComplete((payload) => {
      if (!runIsActive) return;
      const stoppedEarly = payload && payload.stoppedEarly;
      const reason = payload && payload.reason ? String(payload.reason) : '';
      appendRunLog(
        `Run complete${stoppedEarly ? ' (stopped early)' : ''}${reason ? `: ${reason}` : ''}`
      );
      runIsActive = false;
      setButtonsDisabled(false);
    });
  }

  if (btnRun) {
    btnRun.addEventListener('click', async () => {
      if (runIsActive) return;
      runIsActive = true;
      runLogLines = [];
      snapshotBlockColours();
      resetBlockColours();
      setButtonsDisabled(true);
      appendRunLog('Run started…');

      try {
        const res = await window.electronAPI.runBackend();
        appendRunLog(res && res.wsUrl ? `WebSocket: ${res.wsUrl}` : 'Backend spawned.');
      } catch (e) {
        runIsActive = false;
        setButtonsDisabled(false);
        const msg = e && e.message ? e.message : String(e);
        setStatus(`Run failed: ${msg}`);
      }
    });
  }

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
