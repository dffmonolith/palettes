/*global
console,localStorage,prompt,document,confirm,alert
*/
// *******************************
// *** Palettes by DFF           ***
// *** V2.5 on 10/3/26           ***
// *** (formerly Palettes) ***
// *** Vanilla JS — no jQuery    ***
// *******************************
const Palettes = (function() {
  "use strict";
  //
  // Single source of truth for the version shown next to the title in
  // Palettes.html (#version-badge). Bump this — and the banner above
  // — whenever a new version ships, and archive the outgoing files into
  // ARCHIVE/ first (see the project's ARCHIVE workflow).
  const VERSION = '2.5';
  //
  // Define Private Variables -- initialized at the bottom of Palettes definition, just before
  // the return statement. Initialization code can't be up here, since the functions it calls are
  // outside the scope (palettesUsingStorage, loadPalettes, initializePalettes).
  //
  let Palettes_initialized = false,  // Controls whether we load from localStorage
    palettes_master_db,       // object containing palette objects, where key is palette name.
    current_palette_name,     // name of the current palette or NULL
    global_seed,              // ever-increasing integer used to seed unique names
    default_palette_size,     // default size of new palettes
    palette_bg_color,         // BG color behind the swatches
    default_color_biases,     // default color biases are Full Range (0-255)
    color_bias_table,         // defines the RGB biases for new color generation
    jump_factor,              // allows bigger adjustments to RGB values
    show_help_settings,       // show the Settings/Help panel
    show_import_export,       // show the Import/Export panel
    show_obvious_headings,    // allows for more compact layout once familiar with things
    verbose_flag = true,      // allows or suppresses normal warnings and alerts
    auto_save_flag,           // not used yet
    global_settings_modified,         // flag tells when global settings are modified
    global_palettes_modified_status,  // flag tells when palettes have been changed
    prefix_localStorage,      // allows namespacing of localStorage resources
    drag_source_id = null;    // tracks dragged colorbox id for HTML5 drag-and-drop
  //
  // Define Private Methods
  //
  function initializePalettes() {
    // Initialize the Palettes module the first time.
    Palettes_initialized = true;
    //
    palettes_master_db = {};
    current_palette_name = null;
    global_seed = 0;
    default_palette_size = 12;
    default_color_biases = { red: 'Full', green: 'Full', blue: 'Full' };
    color_bias_table = {
      'Minimum': [0,   0,   'MINIMUM: Exactly 0%'],
      'Least':   [0,   63,  'LEAST: 0-25%'],
      'Less':    [0,   127, 'LESS: 0-50%'],
      'Middle':  [64,  191, 'MIDDLE: 25-75%'],
      'Half':    [128, 128, 'HALF: Exactly 50%'],
      'More':    [128, 255, 'MORE: 50-100%'],
      'Most':    [192, 255, 'MOST: 75-100%'],
      'Maximum': [255, 255, 'MAXIMUM: Exactly 100%'],
      'Full':    [0,   255, 'FULL: 0-100%']
    };
    jump_factor = 8;
    palette_bg_color = '#cccccc';
    show_help_settings = false;
    show_import_export = false;
    show_obvious_headings = true;
    verbose_flag = true;
    auto_save_flag = false;
    global_settings_modified = false;
    global_palettes_modified_status = false;
    prefix_localStorage = 'Palettes-Palettes-';
    //
    initializeSettingsHelpPanel();
    setupColorBiasSelectors();
    setGlobalSettingsModified(false);
    createInitialPalette('Random-Starter-Palette');
  }
  //
  function loadPalettes() {
    // Load Palettes from saved version in localStorage:
    // 1. Read and assign global settings.
    // 2. Build palettes.
    // 3. Build the UI: content and settings.
    const JSON_data      = localStorage.getItem('Palettes-SETTINGS');
    const global_data    = JSON.parse(JSON_data);
    const JSON_palettes  = localStorage.getItem('Palettes-PALETTE-INDEX');
    const global_palettes = JSON.parse(JSON_palettes);
    const palettes_list  = global_palettes.palettes_list || '';
    const palnames_array = palettes_list.split(',');
    const palnames_length = palnames_array.length;
    //
    // Parse the global settings and palettes, assign to global settings.
    current_palette_name = global_palettes ? global_palettes.current_palette_name : null;
    // stored separately to ensure it never overlaps existing materials that aren't saved.
    global_seed = parseInt(localStorage.getItem('Palettes-SEED'), 10);
    //
    default_palette_size  = global_data.default_palette_size;
    default_color_biases  = global_data.default_color_biases;
    color_bias_table      = global_data.color_bias_table;
    jump_factor           = global_data.jump_factor;
    show_help_settings    = global_data.show_help_settings;
    show_import_export    = global_data.show_import_export;
    auto_save_flag        = global_data.auto_save_flag;
    palette_bg_color      = global_data.palette_bg_color;
    show_obvious_headings = global_data.show_obvious_headings;
    verbose_flag          = global_data.verbose_flag;
    prefix_localStorage   = global_data.prefix_localStorage;
    //
    global_settings_modified = false;
    global_palettes_modified_status = false;
    Palettes_initialized = true;
    // Rebuild the Palette objects.
    palettes_master_db = {};
    for (let i = 0; i < palnames_length; i++) {
      const curname = palnames_array[i];
      loadPaletteFromStorage(curname);
    }
    // Update the UI.
    setCurrentPalette(current_palette_name, null);
    setupColorBiasSelectors();
    initializeSettingsHelpPanel();
  }
  //
  // *** UTILITY Methods ***
  //
  function alerter(alert_text, console_flag) {
    if (verbose_flag && alert_text && alert_text.length > 0) {
      if (console_flag) {
        console.log(alert_text);
      } else {
        alert(alert_text);
      }
    }
  }
  //
  function defineColorBiasRanges(bias_object) {
    // Allows the user to replace the standard bias ranges.
    if (bias_object) {
      color_bias_table = bias_object;
      setupColorBiasSelectors();
      setGlobalSettingsModified(true);
    }
  }
  //
  function deepCopyObject(oldobject) {
    // Deep copy using JSON round-trip (works for plain data objects).
    // Replaces jQuery.extend(true, {}, oldobject).
    return JSON.parse(JSON.stringify(oldobject));
  }
  //
  function migrateLegacyStorage() {
    // V2.5 renamed the app from Palette Tweaker to Palettes, and its localStorage
    // keys from 'PaletteTweaker-*' to 'Palettes-*'. On the first run after the
    // rename, copy any old keys across so nobody loses saved palettes. The old
    // keys are left in place (harmless, and the ARCHIVE versions still read them).
    if (!supportsHtml5Storage()) { return; }
    try {
      if (localStorage.getItem('Palettes-SETTINGS') !== null) { return; }  // already migrated
      if (localStorage.getItem('PaletteTweaker-SETTINGS') === null) { return; }  // nothing to migrate
      const old_keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.indexOf('PaletteTweaker-') === 0) { old_keys.push(key); }
      }
      old_keys.forEach(function(key) {
        localStorage.setItem('Palettes-' + key.slice('PaletteTweaker-'.length), localStorage.getItem(key));
      });
      console.log('*** Palettes: migrated ' + old_keys.length + ' localStorage keys from PaletteTweaker-* to Palettes-*');
    } catch(e) {
      console.log('*** Palettes: localStorage migration failed: ' + e);
    }
  }
  //
  function palettesUsingStorage() {
    // Returns TRUE if the browser supports localStorage and we are already using it.
    if (supportsHtml5Storage()) {
      try {
        return !!localStorage.getItem('Palettes-SETTINGS');
      } catch(e) {
        return false;
      }
    } else {
      return false;
    }
  }
  //
  function supportsHtml5Storage() {
    try {
      return !!window.localStorage;
    } catch(e) {
      return false;
    }
  }
  //
  function trim(stringToTrim) {
    return stringToTrim.replace(/^\s+|\s+$/g, "");
  }
  //
  function loadPaletteFromStorage(palname) {
    const storage_name   = prefix_localStorage + palname;
    const JSON_string    = localStorage.getItem(storage_name);
    const palette_object = JSON.parse(JSON_string);
    palettes_master_db[palname] = palette_object;
    setAllKeepFlags(palette_object);
  }
  //
  function createColorObjectID() {
    return 'CID-' + privateGetNewSeed();
  }
  //
  function privateGetNewSeed() {
    global_seed += 1;
    saveGlobalSeed();
    return global_seed;
  }
  //
  function saveGlobalSeed() {
    if (supportsHtml5Storage()) {
      localStorage.setItem('Palettes-SEED', global_seed);
    }
  }
  //
  function deleteFromStorage(key) {
    if (palettesUsingStorage()) {
      localStorage.removeItem(prefix_localStorage + key);
    }
  }
  //
  function saveAllToStorage(event) {
    if (supportsHtml5Storage()) {
      saveGlobalSeed();
      saveGlobalSettings();
      savePalettesIndex();
      saveAllPaletteObjects();
      updatePaletteNamesList();
    } else {
      alerter('SAVE failed -- unable to access localStorage in your browser.', false);
    }
    event.preventDefault();
  }
  //
  function savePalettesIndex() {
    const palettes_list = getPalettesListCSV();
    const palettes_info = {
      current_palette_name: current_palette_name,
      palettes_list: palettes_list
    };
    const palsdata  = JSON.stringify(palettes_info);
    const save_str  = '\nPalettes SAVE [Palettes]: ';
    if (supportsHtml5Storage()) {
      localStorage.setItem('Palettes-PALETTE-INDEX', palsdata);
      updatePaletteDisplay();
    } else {
      alerter(save_str + 'ERROR: localStorage is unavailable.', true);
    }
  }
  //
  function getPalettesListCSV() {
    const name_array = palettes_master_db ? Object.keys(palettes_master_db) : [];
    return name_array.join(',');
  }
  //
  function saveAllPaletteObjects() {
    const allkeys = Object.keys(palettes_master_db);
    for (const key of allkeys) {
      savePaletteObject(key);
    }
  }
  //
  function savePaletteObject(key) {
    const save_key = prefix_localStorage + key;
    const palette  = palettes_master_db[key];
    if (palette) {
      if (palette.modified_status === true) {
        palette.modified_status = false;
        const json_palette = JSON.stringify(palette);
        if (supportsHtml5Storage()) {
          localStorage.setItem(save_key, json_palette);
          return true;
        } else {
          alerter('Unable to SAVE -- localStorage not supported.', true);
          return false;
        }
      } else {
        return false;
      }
    } else {
      alerter('Unable to save palette "' + key + '"', true);
      return false;
    }
  }
  //
  function saveGlobalSettings() {
    const global_data = {
      default_palette_size:  default_palette_size,
      default_color_biases:  default_color_biases,
      color_bias_table:      color_bias_table,
      jump_factor:           jump_factor,
      palette_bg_color:      palette_bg_color,
      show_help_settings:    show_help_settings,
      show_import_export:    show_import_export,
      show_obvious_headings: show_obvious_headings,
      verbose_flag:          verbose_flag,
      auto_save_flag:        auto_save_flag,
      prefix_localStorage:   prefix_localStorage
    };
    const jsondata = JSON.stringify(global_data);
    if (supportsHtml5Storage()) {
      localStorage.setItem('Palettes-SETTINGS', jsondata);
      clearGlobalSettingsChangedDisplay();
    } else {
      alerter('Palettes SAVE [Settings]: not saved.', true);
    }
  }
  //
  // *** USER INTERFACE Methods ***
  //
  function initializeSettingsHelpPanel() {
    setText('palette-size-field', default_palette_size);
    setText('jump-size-field', jump_factor);
    setText('palette-bg-color', palette_bg_color);
    setText('show-headings-flag', show_obvious_headings ? 'Yes' : 'No');
    setText('show-verbose-flag', verbose_flag ? 'Yes' : 'No');
    //
    document.querySelectorAll('.helping-header').forEach(el => {
      el.style.display = show_obvious_headings ? '' : 'none';
    });
    document.body.style.backgroundColor = palette_bg_color;
    const outerbox = document.getElementById('outerbox');
    if (outerbox) { outerbox.style.backgroundColor = palette_bg_color; }
  }
  //
  function setAllKeepFlags(palobj) {
    // Sets the KEEP flag for all color swatches in the given palette object.
    if (palobj) {
      const colors_from_palette = palobj.colors;
      for (const key of Object.keys(colors_from_palette)) {
        colors_from_palette[key].keep = 'YES';
      }
    } else {
      alerter('You must select a palette for this operation.', false);
    }
  }
  //
  function setupColorBiasSelectors() {
    // Sets up color bias selectors for the current palette, based on color_bias_table settings.
    const current_palette = getCurrentPalette();
    if (!current_palette) return;
    //
    const selred   = document.getElementById('selector-red');
    const selgreen = document.getElementById('selector-green');
    const selblue  = document.getElementById('selector-blue');
    //
    // Clear existing options from all three selects.
    [selred, selgreen, selblue].forEach(sel => { sel.innerHTML = ''; });
    //
    // First option is the disabled label.
    const addDisabledOption = (sel, label) => {
      const opt = document.createElement('option');
      opt.value = '';
      opt.disabled = true;
      opt.selected = true;
      opt.textContent = label;
      sel.appendChild(opt);
    };
    addDisabledOption(selred,   'Select RED Bias:');
    addDisabledOption(selgreen, 'Select GREEN Bias:');
    addDisabledOption(selblue,  'Select BLUE Bias:');
    //
    // Add options to all 3 SELECTs — bias definitions are the same for each.
    for (const key of Object.keys(color_bias_table)) {
      const minmax = color_bias_table[key];
      [selred, selgreen, selblue].forEach(sel => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = minmax[2];
        sel.appendChild(opt);
      });
    }
    //
    // Select the current value for each bias selector.
    const current_biases = current_palette.color_biases;
    selred.value   = current_biases.red;
    selgreen.value = current_biases.green;
    selblue.value  = current_biases.blue;
  }
  //
  function getCurrentPalette() {
    return current_palette_name ? palettes_master_db[current_palette_name] : null;
  }
  //
  function paletteExists(checkname) {
    return !!(checkname && palettes_master_db[checkname]);
  }
  //
  function setCurrentPalette(palname, palette_string) {
    let resultstr = '';
    let loading_palette_colors = [];
    let register_as_new = false;
    let current_palette = null;
    let set_keep_flag = false;
    //
    if (paletteExists(palname)) {
      // There is a palette with the given name.
      current_palette_name = palname;
      current_palette = palettes_master_db[palname];
      current_palette.palette_size = 0; // recalculated when color swatches are added
      set_keep_flag = true;
      const colors_from_palette = current_palette.colors;
      for (const key of Object.keys(colors_from_palette)) {
        const colorobj = colors_from_palette[key];
        loading_palette_colors.push(key + '|' + colorobj.rrggbb);
      }
    } else {
      // Create new palette.
      const newname = palname || 'RANDOM-' + privateGetNewSeed();
      register_as_new = true;
      current_palette = {
        name: newname,
        palette_size: 0,
        modified_status: true,
        color_biases: deepCopyObject(default_color_biases),
        colors: {}
      };
      palettes_master_db[newname] = current_palette;
      current_palette_name = newname;
      if (palette_string) {
        loading_palette_colors = palette_string.split(',');
      } else {
        for (let i = 0; i < default_palette_size; i++) {
          loading_palette_colors[i] = generateRandomColor();
        }
      }
    }
    //
    // Whether existing or new, turn the palette array into color boxes.
    for (const rawcolor of loading_palette_colors) {
      const newcolor = trim(rawcolor);
      if (newcolor.substr(0, 1) !== '[') {
        resultstr += createColorBox(newcolor, register_as_new, set_keep_flag);
      }
    }
    //
    updatePaletteDisplay();
    //
    // Inject HTML into #palette and set up drag-and-drop.
    const paletteEl = document.getElementById('palette');
    paletteEl.innerHTML = resultstr;
    setupDragAndDrop();
  }
  //
  // *** HTML5 DRAG AND DROP for sortable color swatches ***
  //
  function setupDragAndDrop() {
    // Makes all colorboxes in #palette draggable and sortable.
    const paletteEl = document.getElementById('palette');
    //
    paletteEl.addEventListener('dragstart', onDragStart);
    paletteEl.addEventListener('dragover',  onDragOver);
    paletteEl.addEventListener('dragleave', onDragLeave);
    paletteEl.addEventListener('drop',      onDrop);
    paletteEl.addEventListener('dragend',   onDragEnd);
    //
    // Mark all colorboxes as draggable.
    paletteEl.querySelectorAll('.colorbox').forEach(box => {
      box.setAttribute('draggable', 'true');
    });
  }
  //
  function onDragStart(event) {
    const box = event.target.closest('.colorbox');
    if (!box) return;
    drag_source_id = box.id;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', box.id);
    setTimeout(() => { box.style.opacity = '0.4'; }, 0);
  }
  //
  function onDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const box = event.target.closest('.colorbox');
    if (box && box.id !== drag_source_id) {
      box.style.outline = '2px dashed #555';
    }
  }
  //
  function onDragLeave(event) {
    const box = event.target.closest('.colorbox');
    if (box) { box.style.outline = ''; }
  }
  //
  function onDrop(event) {
    event.preventDefault();
    const target_box = event.target.closest('.colorbox');
    if (!target_box || target_box.id === drag_source_id) return;
    target_box.style.outline = '';
    const paletteEl = document.getElementById('palette');
    const source_box = document.getElementById(drag_source_id);
    if (!source_box) return;
    //
    // Insert source before or after target depending on mouse position.
    const rect = target_box.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    if (event.clientX < midX) {
      paletteEl.insertBefore(source_box, target_box);
    } else {
      paletteEl.insertBefore(source_box, target_box.nextSibling);
    }
    setCurrentModifiedStatus(true);
  }
  //
  function onDragEnd(event) {
    const box = event.target.closest('.colorbox');
    if (box) { box.style.opacity = ''; }
    drag_source_id = null;
    // Clear any lingering outlines.
    document.querySelectorAll('.colorbox').forEach(b => { b.style.outline = ''; });
  }
  //
  function updatePaletteDisplay() {
    const current_palette  = getCurrentPalette();
    const current_biases   = current_palette ? current_palette.color_biases : default_color_biases;
    updateCurrentNameDisplay(current_palette_name);
    updatePaletteNamesList();
    //
    const selred   = document.getElementById('selector-red');
    const selgreen = document.getElementById('selector-green');
    const selblue  = document.getElementById('selector-blue');
    if (selred)   { selred.value   = current_biases.red;   }
    if (selgreen) { selgreen.value = current_biases.green; }
    if (selblue)  { selblue.value  = current_biases.blue;  }
  }
  //
  function updateCurrentNameDisplay(newname) {
    const usename = newname ? '[' + newname + ']' : '[NONE]';
    setText('pnspan', usename);
  }
  //
  function updatePaletteNamesList() {
    const nametext = getLinkedPaletteNames();
    const chooser  = document.getElementById('palette-chooser');
    if (chooser) {
      chooser.innerHTML = nametext.length > 0
        ? '<span class="namestring">' + nametext + '</span>'
        : '<span class="namestring">[No Palettes Yet]</span>';
    }
  }
  //
  function getLinkedPaletteNames() {
    let return_string = '';
    const keys = Object.keys(palettes_master_db).sort();
    for (const key of keys) {
      const pal     = palettes_master_db[key];
      const len     = pal.palette_size;
      const modflag = (pal && pal.modified_status) ? '<span class="symbol-emphasis">&Delta;</span>' : '';
      let linktext  = '<div class="palette-chooser-box">';
      if (key === current_palette_name) {
        linktext += '<a href="#0" class="current-selection"';
        linktext += ' title="This is the Current Palette. Click to RENAME it.">';
        linktext += key + '</a>' + modflag + '(' + len + ')';
      } else {
        linktext += '<a href="#0" class="select-palette" title="Switch to this Palette.">';
        linktext += key + '</a>' + modflag + '(' + len + ')';
      }
      linktext += '</div>';
      return_string += linktext;
    }
    return return_string;
  }
  //
  function createColorBox(rawcolorstr, register_flag, set_keep_flag) {
    // Returns HTML string for a colorbox div.
    let colorstr, newcid, retstr = '';
    if (register_flag) {
      colorstr = normalizeColorString(rawcolorstr);
      newcid   = createColorObjectID();
    } else {
      const split_array = rawcolorstr.split('|');
      newcid   = split_array[0];
      colorstr = normalizeColorString(split_array[1]);
    }
    //
    if (colorstr) {
      const newobj = {
        rrggbb: colorstr,
        rr: parseInt(colorstr.substr(1, 2), 16),
        gg: parseInt(colorstr.substr(3, 2), 16),
        bb: parseInt(colorstr.substr(5, 2), 16)
      };
      const current_palette = getCurrentPalette();
      if (current_palette) {
        current_palette.colors[newcid] = newobj;
        current_palette.palette_size += 1;
      }
      //
      retstr  = '<div class="colorbox" id="' + newcid + '" draggable="true" style="background-color:' + colorstr + '">';
      // Keep (selection) button
      retstr += '<div class="keep_button" title="When checked, this color is safe from randomization.">';
      if (set_keep_flag) {
        retstr += '<img src="includes/green-check.png" class="keep-color" alt="Selected Button" />';
      } else {
        retstr += '<img src="includes/no-selection.png" alt="Unselected Button" />';
      }
      retstr += '</div>';
      // Plus (increment) row
      retstr += '<div class="plus_block">';
      retstr += '<a href="" class="inc_red"   title="Click to add 1 to Red; Shift-Click for bigger jump."><img alt="Increment RED"   src="includes/plus-red.png"   /></a>';
      retstr += '<a href="" class="inc_green" title="Click to add 1 to Green; Shift-Click for bigger jump."><img alt="Increment GREEN" src="includes/plus-green.png" /></a>';
      retstr += '<a href="" class="inc_blue"  title="Click to add 1 to Blue; Shift-Click for bigger jump."><img alt="Increment BLUE"  src="includes/plus-blue.png"  /></a>';
      retstr += '</div>';
      // Color label
      retstr += '<p class="color-label" title="Click to change color." id="X' + newcid + '">' + colorstr + '</p>';
      // Minus (decrement) row
      retstr += '<div class="minus_block">';
      retstr += '<a href="" class="dec_red"   title="Click to reduce Red by 1; Shift-Click for bigger jump."><img alt="Decrement RED"   src="includes/minus-red.png"   /></a>';
      retstr += '<a href="" class="dec_green" title="Click to reduce Green by 1; Shift-Click for bigger jump."><img alt="Decrement GREEN" src="includes/minus-green.png" /></a>';
      retstr += '<a href="" class="dec_blue"  title="Click to reduce Blue by 1; Shift-Click for bigger jump."><img alt="Decrement BLUE"  src="includes/minus-blue.png"  /></a>';
      retstr += '</div>';
      // Delete button
      retstr += '<div class="drop_button" title="Click to delete this color."><img src="includes/red-x.png" alt="Delete button" /></div>';
      retstr += '</div>';
    }
    return retstr;
  }
  //
  function clearImportExportBuffer(event) {
    const buf = document.getElementById('import-export-buffer');
    if (buf) { buf.value = ''; }
    event.preventDefault();
  }
  //
  function getImportExportBufferText() {
    const buf = document.getElementById('import-export-buffer');
    return buf ? buf.value : '';
  }
  //
  function setImportExportBufferText(newtext) {
    const buf = document.getElementById('import-export-buffer');
    if (buf) { buf.value = newtext; }
  }
  //
  function appendToImportExportBuffer(appdata) {
    const buf = document.getElementById('import-export-buffer');
    if (buf) { buf.value += appdata; }
  }
  //
  // *** General Methods ***
  //
  function setCurrentModifiedStatus(newstatus) {
    const current_palette = getCurrentPalette();
    if (current_palette) {
      if (newstatus !== current_palette.modified_status) {
        current_palette.modified_status = newstatus;
        updatePaletteNamesList();
      }
    } else {
      alerter('WARNING: No current_palette, so cannot change modified_status.', true);
    }
  }
  //
  function setGlobalSettingsModified(newstatus) {
    if (newstatus !== global_settings_modified) {
      global_settings_modified = newstatus;
      saveGlobalSettings();
      document.querySelectorAll('.settings-modified').forEach(el => { el.style.display = 'none'; });
    }
  }
  //
  function setGlobalPalettesModifiedStatus(newstatus) {
    global_palettes_modified_status = newstatus;
  }
  //
  function updatePaletteBias(color, newbias) {
    const current_palette = getCurrentPalette();
    if (current_palette) {
      current_palette.color_biases[color] = newbias;
      setCurrentModifiedStatus(true);
    }
  }
  //
  function normalizeColorString(rawcolor) {
    // Returns valid #RRGGBB string or null.
    const regexp_rgb_hex = new RegExp('^[#]?(?:[0-9a-fA-F]{3}){1,2}$', 'g');
    const test_rgb_hex   = regexp_rgb_hex.test(rawcolor);
    let newcol = null;
    if (rawcolor && test_rgb_hex) {
      let check_color;
      if ((rawcolor.length === 3) || (rawcolor.length === 6)) {
        check_color = '#' + rawcolor;
      } else {
        check_color = rawcolor;
      }
      if (check_color.length === 4) {
        // Must be #rgb — expand to #rrggbb.
        const newr = check_color.substr(1, 1);
        const newg = check_color.substr(2, 1);
        const newb = check_color.substr(3, 1);
        newcol = '#' + newr + newr + newg + newg + newb + newb;
      } else {
        newcol = check_color;
      }
    }
    return newcol;
  }
  //
  function generateRandomColor() {
    const curpal        = getCurrentPalette();
    const color_biases  = curpal ? curpal.color_biases : default_color_biases;
    const random_red    = generateBiasedNumber(color_biases.red);
    const random_green  = generateBiasedNumber(color_biases.green);
    const random_blue   = generateBiasedNumber(color_biases.blue);
    return '#' + returnHex(random_red) + returnHex(random_green) + returnHex(random_blue);
  }
  //
  function generateBiasedNumber(bias_state) {
    const range_array = color_bias_table[bias_state] || [0, 255];
    const range_min   = range_array[0];
    const range_max   = range_array[1];
    const range_len   = range_max - range_min + 1;
    if (range_len === 1) {
      return range_min;
    } else {
      return Math.floor(Math.random() * range_len) + range_min;
    }
  }
  //
  function returnHex(num) {
    const str = num.toString(16);
    return (str.length < 2) ? '0' + str : str;
  }
  //
  // *** Functions Bound to UI Elements ***
  //
  // Import/Export and Settings now open as modals (used to be inline panels
  // toggled with display:none/''). Both share this same open/close pair —
  // see #import-export-modal / #settings-modal in Palettes.html and
  // their .modal-overlay/.modal-box styling in Palettes.css.
  //
  function openModal(modal_id) {
    const modal = document.getElementById(modal_id);
    if (modal) {
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('modal-open');
    }
  }
  //
  function closeModal(modal_id) {
    const modal = document.getElementById(modal_id);
    if (modal) {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('modal-open');
    }
  }
  //
  function closeAllModals() {
    closeModal('import-export-modal');
    closeModal('settings-modal');
  }
  //
  function toggleImportExportPanel(event) {
    const modal = document.getElementById('import-export-modal');
    if (modal && modal.classList.contains('is-open')) {
      closeModal('import-export-modal');
    } else {
      openModal('import-export-modal');
    }
    if (event) { event.preventDefault(); }
  }
  //
  function toggleSettingsHelpPanel(event) {
    const modal = document.getElementById('settings-modal');
    if (modal && modal.classList.contains('is-open')) {
      closeModal('settings-modal');
    } else {
      openModal('settings-modal');
    }
    if (event) { event.preventDefault(); }
  }
  //
  function changeDefaultPaletteSize(event) {
    const newdefault = prompt('Default number of color boxes in a palette?', default_palette_size);
    const newnum = parseInt(newdefault, 10);
    if (newdefault && (newnum !== default_palette_size) && (newnum > 0)) {
      default_palette_size = newnum;
      setText('palette-size-field', default_palette_size);
      setGlobalSettingsModified(true);
    }
    event.preventDefault();
  }
  //
  function changeJumpSize(event) {
    const newdefault = prompt('How far to bump RGB Values when Shifted?', jump_factor);
    const newnum = parseInt(newdefault, 10);
    if (newdefault && (newnum !== jump_factor) && (newnum > 0) && (newnum < 128)) {
      jump_factor = newnum;
      setText('jump-size-field', jump_factor);
      setGlobalSettingsModified(true);
    }
    event.preventDefault();
  }
  //
  function changeBgColor(event) {
    const newdefault = prompt('New RGB (#rrggbb) value for Background?', palette_bg_color);
    const newcolor   = newdefault ? normalizeColorString(newdefault) : palette_bg_color;
    if (newcolor && (newcolor !== palette_bg_color)) {
      palette_bg_color = newcolor;
      setText('palette-bg-color', palette_bg_color);
      document.body.style.backgroundColor = newcolor;
      const outerbox = document.getElementById('outerbox');
      if (outerbox) { outerbox.style.backgroundColor = newcolor; }
      setGlobalSettingsModified(true);
    }
    event.preventDefault();
  }
  //
  function toggleObviousHeadings(event) {
    show_obvious_headings = !show_obvious_headings;
    setText('show-headings-flag', show_obvious_headings ? 'Yes' : 'No');
    document.querySelectorAll('.helping-header').forEach(el => {
      el.style.display = show_obvious_headings ? '' : 'none';
    });
    event.preventDefault();
  }
  //
  function toggleVerboseFlag(event) {
    verbose_flag = !verbose_flag;
    setText('show-verbose-flag', verbose_flag ? 'Yes' : 'No');
    event.preventDefault();
  }
  //
  function toggleKeepButton(event) {
    const div = event.target.closest('div.colorbox');
    if (div) { toggleKeepStatus(div); }
    event.preventDefault();
  }
  //
  function toggleKeepStatus(div) {
    const keep_off  = 'includes/no-selection.png';
    const keep_on   = 'includes/green-check.png';
    const fid       = div.id;
    const current_palette       = getCurrentPalette();
    const current_color_object  = current_palette.colors[fid];
    const img = div.querySelector('.keep_button img');
    if (img.classList.contains('keep-color')) {
      img.classList.remove('keep-color');
      img.src = keep_off;
      current_color_object.keep = 'NO';
    } else {
      img.classList.add('keep-color');
      img.src = keep_on;
      current_color_object.keep = 'YES';
    }
    setCurrentModifiedStatus(true);
  }
  //
  function paletteSelectAllSwatches(event) {
    if (getCurrentPalette()) {
      paletteGroupSelection(true);
      setCurrentModifiedStatus(true);
    }
    event.preventDefault();
  }
  //
  function paletteUnselectAllSwatches(event) {
    if (getCurrentPalette()) {
      paletteGroupSelection(false);
      setCurrentModifiedStatus(true);
    }
    event.preventDefault();
  }
  //
  function paletteGroupSelection(selection_flag) {
    const paletteEl = document.getElementById('palette');
    for (const div of paletteEl.children) {
      const img = div.querySelector('.keep_button img');
      if (!img) continue;
      const hasClass = img.classList.contains('keep-color');
      if (hasClass && !selection_flag) { toggleKeepStatus(div); }
      if (!hasClass && selection_flag) { toggleKeepStatus(div); }
    }
  }
  //
  // *** COLORBOX (Swatch) COMMANDS ***
  //
  function randomizePalette(event) {
    const current_palette = getCurrentPalette();
    if (current_palette) {
      const kept = removeUnselectedColorSwatches();
      const left = current_palette.palette_size - kept;
      if (left > 0) {
        current_palette.palette_size = kept;
        const remainder = (left < 0) ? 0 : left;
        const paletteEl = document.getElementById('palette');
        for (let i = 0; i < remainder; i++) {
          const rancol = generateRandomColor();
          const newbox = createColorBox(rancol, true, false);
          paletteEl.insertAdjacentHTML('beforeend', newbox);
          // Make new box draggable.
          const newEl = paletteEl.lastElementChild;
          if (newEl) { newEl.setAttribute('draggable', 'true'); }
        }
        setCurrentModifiedStatus(true);
        updatePaletteNamesList();
      } else {
        alerter('Nothing to randomize, since all swatches are checked (protected).', false);
      }
    } else {
      alerter('You must create or select a palette to use the Randomize function.', false);
    }
    event.preventDefault();
  }
  //
  function removeUnselectedColorSwatches() {
    let keep_count = 0;
    const paletteEl      = document.getElementById('palette');
    const current_palette = getCurrentPalette();
    // Collect children first to avoid live NodeList mutation issues.
    const children = Array.from(paletteEl.children);
    for (const div of children) {
      const fid = div.id;
      const img = div.querySelector('.keep_button img');
      if (img && img.classList.contains('keep-color')) {
        keep_count++;
      } else {
        delete current_palette.colors[fid];
        div.remove();
      }
    }
    return keep_count;
  }
  //
  function addColorToPalette(event) {
    if (getCurrentPalette()) {
      const rand = generateRandomColor();
      const colors_string = prompt('Enter 1 or more Colors like this: #rrggbb,#rrggbb,#rrggbb :', rand);
      const new_num = addMultipleColorsFromString(colors_string);
      if (new_num === 0) {
        alerter('WARNING: Did not find any colors in your input text.', false);
      }
    } else {
      alerter('WARNING: Select or Create a palette before adding colors.', false);
    }
    event.preventDefault();
  }
  //
  function addMultipleColorsFromString(multi_colors) {
    if (!multi_colors) return 0;
    const good_colors      = [];
    const potential_colors = multi_colors.split(',');
    for (const raw of potential_colors) {
      const testcol = normalizeColorString(trim(raw));
      if (testcol) { good_colors.push(testcol); }
    }
    const good_knt = good_colors.length;
    if (good_knt > 0) {
      const paletteEl = document.getElementById('palette');
      for (const curcol of good_colors) {
        const new_html = createColorBox(curcol, true, false);
        paletteEl.insertAdjacentHTML('beforeend', new_html);
        // Make new box draggable.
        const newEl = paletteEl.lastElementChild;
        if (newEl) { newEl.setAttribute('draggable', 'true'); }
        setCurrentModifiedStatus(true);
        updatePaletteNamesList();
      }
    }
    return good_knt;
  }
  //
  function validateColorString(multi_colors) {
    // Returns number of valid colors found.
    const good_colors      = [];
    const potential_colors = multi_colors.split(',');
    for (const raw of potential_colors) {
      const testcol = normalizeColorString(trim(raw));
      if (testcol) { good_colors.push(testcol); }
    }
    return good_colors.length;
  }
  //
  // These functions increment and decrement different color components.
  //
  function incrementRed(event) {
    processIncDecRequest(event.target, 'rr', event.shiftKey, true);
    event.preventDefault();
  }
  function incrementGreen(event) {
    processIncDecRequest(event.target, 'gg', event.shiftKey, true);
    event.preventDefault();
  }
  function incrementBlue(event) {
    processIncDecRequest(event.target, 'bb', event.shiftKey, true);
    event.preventDefault();
  }
  function decrementRed(event) {
    processIncDecRequest(event.target, 'rr', event.shiftKey, false);
    event.preventDefault();
  }
  function decrementGreen(event) {
    processIncDecRequest(event.target, 'gg', event.shiftKey, false);
    event.preventDefault();
  }
  function decrementBlue(event) {
    processIncDecRequest(event.target, 'bb', event.shiftKey, false);
    event.preventDefault();
  }
  //
  function processIncDecRequest(target, rgb_component, jump_flag, upward) {
    const multiplier  = upward ? 1 : -1;
    const inc_amount  = jump_flag ? jump_factor * multiplier : multiplier;
    const div         = target.closest('div.colorbox');
    const fid         = div.id;
    const label       = document.getElementById('X' + fid);
    const current_palette       = getCurrentPalette();
    const current_color_object  = current_palette.colors[fid];
    let target_val = current_color_object[rgb_component];
    if ((upward && target_val < (256 - inc_amount)) || (!upward && ((target_val + inc_amount) >= 0))) {
      target_val += inc_amount;
      current_color_object[rgb_component] = target_val;
      const newcolstr = '#'
        + returnHex(current_color_object.rr)
        + returnHex(current_color_object.gg)
        + returnHex(current_color_object.bb);
      current_color_object.rrggbb = newcolstr;
      if (label) { label.textContent = newcolstr; }
      div.style.backgroundColor = newcolstr;
      setCurrentModifiedStatus(true);
    }
  }
  //
  function dropColor(event) {
    const div = event.target.closest('div.colorbox');
    const fid = div.id;
    const current_palette = getCurrentPalette();
    delete current_palette.colors[fid];
    div.remove();
    current_palette.palette_size -= 1;
    setCurrentModifiedStatus(true);
    updatePaletteNamesList();
    event.preventDefault();
  }
  //
  function replaceColor(event) {
    const div     = event.target.closest('div.colorbox');
    const fid     = div.id;
    const label   = div.querySelector('.color-label');
    const rentxt  = label ? label.textContent : '';
    const rawcol  = prompt('Enter the new color (#rrggbb): ', rentxt);
    const newcol  = rawcol ? normalizeColorString(rawcol) : null;
    if (newcol && newcol !== rentxt) {
      changeColorSwatchColor(div, newcol);
      setCurrentModifiedStatus(true);
    }
    event.preventDefault();
  }
  //
  function changeColorSwatchColor(div, newcolstr) {
    const fid = div.id;
    const label = document.getElementById('X' + fid);
    const current_palette      = getCurrentPalette();
    const current_color_object = current_palette.colors[fid];
    current_color_object.rrggbb = newcolstr;
    current_color_object.rr = parseInt(newcolstr.substr(1, 2), 16);
    current_color_object.gg = parseInt(newcolstr.substr(3, 2), 16);
    current_color_object.bb = parseInt(newcolstr.substr(5, 2), 16);
    if (label) { label.textContent = newcolstr; }
    div.style.backgroundColor = newcolstr;
    setCurrentModifiedStatus(true);
  }
  //
  // PALETTE COMMANDS
  //
  function createNewPalette(event) {
    const newname = 'RANDOM-' + privateGetNewSeed();
    const palname = prompt('Enter NAME for new palette:', newname);
    if (palname && !paletteExists(palname)) {
      createInitialPalette(palname);
    } else {
      alerter('Invalid or duplicate name supplied.', false);
    }
    event.preventDefault();
  }
  //
  function createInitialPalette(newname) {
    const palname = newname || 'InitialPalette-' + privateGetNewSeed();
    setCurrentPalette(palname, null);
    setCurrentModifiedStatus(true);
    setGlobalPalettesModifiedStatus(true);
  }
  //
  function deletePalette(event) {
    if (current_palette_name && paletteExists(current_palette_name)) {
      if (confirm('DELETE the Current Palette (' + current_palette_name + ')?')) {
        delete palettes_master_db[current_palette_name];
        current_palette_name = null;
        updateCurrentNameDisplay(null);
        const paletteEl = document.getElementById('palette');
        if (paletteEl) { paletteEl.innerHTML = ''; }
        setGlobalPalettesModifiedStatus(true);
        updatePaletteDisplay();
      }
    } else {
      alerter("This deletes the Current Palette, but there isn't one.", false);
    }
    event.preventDefault();
  }
  //
  function selectPalette(event) {
    const newpal = event.target.textContent;
    setCurrentPalette(newpal, null);
    setGlobalPalettesModifiedStatus(true);
    event.preventDefault();
  }
  //
  function clearGlobalSettingsChangedDisplay() {
    document.querySelectorAll('.settings-modified').forEach(el => { el.style.display = 'none'; });
  }
  //
  function exportCurrentPalette(event) {
    if (event.shiftKey) {
      exportAllPaletteObjects();
    } else {
      const current_palette = getCurrentPalette();
      if (current_palette) {
        setImportExportBufferText(collectCurrentColorValues());
      } else {
        alerter("Unable to EXPORT the Current Palette, since there isn't one.", false);
      }
    }
    event.preventDefault();
  }
  //
  function exportAllPaletteObjects() {
    const collected_strings = [];
    for (const key of Object.keys(palettes_master_db)) {
      const palette             = palettes_master_db[key];
      const colors_from_palette = palette.colors;
      const loading_palette_colors = ['[' + key + ']'];
      for (const colkey of Object.keys(colors_from_palette)) {
        loading_palette_colors.push(colors_from_palette[colkey].rrggbb);
      }
      collected_strings.push(loading_palette_colors.join(','));
    }
    setImportExportBufferText(collected_strings.join('\n'));
  }
  //
  function collectCurrentColorValues() {
    // Returns CSV string of colors in the current palette, prefixed with palette name.
    const paletteEl = document.getElementById('palette');
    let colstring   = '[' + current_palette_name + ']';
    for (const div of paletteEl.children) {
      const label = div.querySelector('.color-label');
      if (label) { colstring += ',' + label.textContent; }
    }
    return colstring;
  }
  //
  function importPalettePrompted(event) {
    const newname = 'RANDOM-' + privateGetNewSeed();
    const palname = prompt('Enter IMPORT PALETTE NAME:', newname);
    if (palname && !paletteExists(palname)) {
      const newpal = prompt('Enter PALETTE CSV String: ', '#000000,#ff6666,#6f6,#66f,#f6f,#ffffff');
      if (palname.length > 0 && newpal && newpal.length > 0) {
        setCurrentPalette(palname, newpal);
        setGlobalPalettesModifiedStatus(true);
      } else {
        alerter('Unable to import palette with the input that was supplied.', false);
      }
    } else {
      alerter('Specified palette name already in use.', false);
    }
    event.preventDefault();
  }
  //
  function importPaletteFromBuffer(event) {
    const newpal      = getImportExportBufferText();
    const namepresent = newpal.match(/^\[(.*?)\]/);
    const checkname   = namepresent ? namepresent[1] : null;
    if (newpal) {
      if (paletteExists(checkname)) {
        alerter('This palette name is already in use. Edit it or use MERGE to add colors to existing palettes.', false);
      } else {
        if (validateColorString(newpal) > 0) {
          const newname = checkname || 'RANDOM-' + privateGetNewSeed();
          setCurrentPalette(newname, newpal);
          setGlobalPalettesModifiedStatus(true);
        } else {
          alerter('No valid colors found in the Import Buffer.', false);
        }
      }
    } else {
      alerter('Called IMPORT_FROM_BUFFER, but nothing found.', false);
    }
    event.preventDefault();
  }
  //
  function mergeColorsFromBuffer(event) {
    const newcolstring = getImportExportBufferText();
    if (newcolstring) {
      const added_knt = addMultipleColorsFromString(newcolstring);
      if (added_knt < 1) {
        alerter('No valid colors found in the import buffer.', false);
      }
    } else {
      alerter('Called MERGE_FROM_BUFFER, but nothing found in the Import Buffer.', false);
    }
    event.preventDefault();
  }
  //
  function renameCurrentPalette(event) {
    const current_palette = getCurrentPalette();
    const oldpal = current_palette_name;
    if (current_palette) {
      const palname = prompt('Enter new Palette Name: ', oldpal);
      if (palname && (palname !== oldpal) && !paletteExists(palname)) {
        current_palette.name = palname;
        palettes_master_db[palname] = current_palette;
        current_palette_name = palname;
        delete palettes_master_db[oldpal];
        setCurrentModifiedStatus(true);
        setGlobalPalettesModifiedStatus(true);
        updatePaletteDisplay();
      } else {
        alerter('Unable to rename palette as requested.', false);
      }
    } else {
      alerter("RENAME applies to the Current Palette, but there isn't one.", false);
    }
    event.preventDefault();
  }
  //
  // *** SMALL DOM HELPER ***
  //
  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) { el.textContent = value; }
  }
  //
  // **************************************************************************************
  // * This code runs after all the methods are defined at runtime. If we're already using
  // * localStorage, then it loads Palettes data and settings from there. If not, it
  // * uses default values to initialize Palettes. Hey, can you say "hoist"?
  // **************************************************************************************
  migrateLegacyStorage();
  if (!Palettes_initialized) {
    if (palettesUsingStorage() === true) {
      alerter('Initializing Palettes: loading from localStorage....', true);
      loadPalettes();
    } else {
      alerter('Initializing Palettes: loading from default values....', true);
      initializePalettes();
    }
  }
  //
  // *** Define Public Interface to Palettes singleton object. ***
  //
  return {
    VERSION,
    initializePalettes,
    palettesUsingStorage,
    loadPalettes,
    alerter,
    paletteExists,
    getCurrentPalette,
    selectPalette,
    setCurrentPalette,
    addColorToPalette,
    randomizePalette,
    updatePaletteBias,
    defineColorBiasRanges,
    updatePaletteDisplay,
    createNewPalette,
    renameCurrentPalette,
    importPalette:              importPalettePrompted,
    deletePalette,
    saveAllToStorage,
    getNewSeed:                 privateGetNewSeed,
    toggleSettings:             toggleSettingsHelpPanel,
    toggleExporter:             toggleImportExportPanel,
    closeModal,
    closeAllModals,
    changeSize:                 changeDefaultPaletteSize,
    changeJumpSize,
    changeBgColor,
    toggleObviousHeadings,
    toggleVerboseFlag,
    exportCurrentPalette,
    mergeBuffer:                mergeColorsFromBuffer,
    importBuffer:               importPaletteFromBuffer,
    clearBuffer:                clearImportExportBuffer,
    paletteSelectAllSwatches,
    paletteUnselectAllSwatches,
    toggleKeepButton,
    dropColor,
    replaceColor,
    incrementRed,
    incrementGreen,
    incrementBlue,
    decrementRed,
    decrementGreen,
    decrementBlue
  };
})();


// *** Wire up all UI events after DOM is ready ***
document.addEventListener('DOMContentLoaded', () => {

  // Palette management commands
  document.getElementById('rename-button').addEventListener('click',    Palettes.renameCurrentPalette);
  document.getElementById('delete-button').addEventListener('click',    Palettes.deletePalette);
  document.getElementById('new-button').addEventListener('click',       Palettes.createNewPalette);
  document.getElementById('save-all-button').addEventListener('click',  Palettes.saveAllToStorage);
  document.getElementById('settings-button').addEventListener('click',  Palettes.toggleSettings);
  document.getElementById('exporter-button').addEventListener('click',  Palettes.toggleExporter);

  // Import/Export and Settings modals: close button, click-the-backdrop-to-close,
  // and Escape closes whichever one is open.
  document.getElementById('import-export-close').addEventListener('click', () => Palettes.closeModal('import-export-modal'));
  document.getElementById('settings-close').addEventListener('click',      () => Palettes.closeModal('settings-modal'));
  ['import-export-modal', 'settings-modal'].forEach(modal_id => {
    document.getElementById(modal_id).addEventListener('click', (event) => {
      if (event.target.id === modal_id) { Palettes.closeModal(modal_id); }
    });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { Palettes.closeAllModals(); }
  });

  // Version badge next to the title — single source of truth is Palettes.VERSION.
  const version_badge = document.getElementById('version-badge');
  if (version_badge) { version_badge.textContent = 'v' + Palettes.VERSION; }

  // Settings commands
  document.getElementById('palette-sizer').addEventListener('click',   Palettes.changeSize);
  document.getElementById('jump-sizer').addEventListener('click',      Palettes.changeJumpSize);
  document.getElementById('bg-colorer').addEventListener('click',      Palettes.changeBgColor);
  document.getElementById('bg-headings').addEventListener('click',     Palettes.toggleObviousHeadings);
  document.getElementById('bg-verbose').addEventListener('click',      Palettes.toggleVerboseFlag);

  // Import / Export / Merge commands
  document.getElementById('merge-buffer').addEventListener('click',    Palettes.mergeBuffer);
  document.getElementById('import-buffer').addEventListener('click',   Palettes.importBuffer);
  document.getElementById('export-buffer').addEventListener('click',   Palettes.exportCurrentPalette);
  document.getElementById('clear-buffer').addEventListener('click',    Palettes.clearBuffer);

  // Palette / Color commands
  document.getElementById('random-button').addEventListener('click',   Palettes.randomizePalette);
  document.getElementById('select-button').addEventListener('click',   Palettes.paletteSelectAllSwatches);
  document.getElementById('deselect-button').addEventListener('click', Palettes.paletteUnselectAllSwatches);
  document.getElementById('add-button').addEventListener('click',      Palettes.addColorToPalette);

  // Dynamically created colorbox buttons — use event delegation on #palette.
  // This replaces jQuery(document).on('click', selector, handler).
  document.getElementById('palette').addEventListener('click', (event) => {
    if (event.target.closest('.keep_button'))  { Palettes.toggleKeepButton(event); }
    if (event.target.closest('.drop_button'))  { Palettes.dropColor(event); }
    if (event.target.closest('.color-label'))  { Palettes.replaceColor(event); }
    if (event.target.closest('.inc_red'))      { Palettes.incrementRed(event); }
    if (event.target.closest('.inc_green'))    { Palettes.incrementGreen(event); }
    if (event.target.closest('.inc_blue'))     { Palettes.incrementBlue(event); }
    if (event.target.closest('.dec_red'))      { Palettes.decrementRed(event); }
    if (event.target.closest('.dec_green'))    { Palettes.decrementGreen(event); }
    if (event.target.closest('.dec_blue'))     { Palettes.decrementBlue(event); }
  });

  // Palette chooser clicks (current-selection = rename, select-palette = switch).
  document.getElementById('palette-chooser').addEventListener('click', (event) => {
    if (event.target.classList.contains('current-selection')) { Palettes.renameCurrentPalette(event); }
    if (event.target.classList.contains('select-palette'))    { Palettes.selectPalette(event); }
  });

  // Color bias selectors.
  document.getElementById('selector-red').addEventListener('change', (event) => {
    Palettes.updatePaletteBias('red', event.target.value);
  });
  document.getElementById('selector-green').addEventListener('change', (event) => {
    Palettes.updatePaletteBias('green', event.target.value);
  });
  document.getElementById('selector-blue').addEventListener('change', (event) => {
    Palettes.updatePaletteBias('blue', event.target.value);
  });

  // DEBUG: viewport size display in lower-right corner.
  const counter = document.createElement('p');
  counter.classList.add('viewport-width-counter');
  document.body.appendChild(counter);
  Object.assign(counter.style, {
    position:        'fixed',
    bottom:          '0',
    right:           '0',
    padding:         '5px',
    borderRadius:    '8px 0 0 0',
    backgroundColor: '#fdc303',
    fontFamily:      'sans-serif',
    margin:          '0',
    boxShadow:       'rgba(0, 0, 0, 0.6) 1px 1px 0px',
    color:           '#001485',
    zIndex:          '9999'
  });
  const updateViewportCounter = () => {
    counter.textContent = window.innerWidth + 'px';
  };
  updateViewportCounter();
  window.addEventListener('resize', updateViewportCounter);

});
