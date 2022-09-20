//@ts-check

var term;
var vscode;

/**
 * @param {{ innerWidth: number; innerHeight: number; }} win
 */
function calculateSize(win) {
  var cols = Math.max(60, Math.min(150, (win.innerWidth) / 7)) | 0;
  var rows = Math.max(10, Math.min(80, (win.innerHeight - 40) / 12)) | 0;
  return [cols, rows];
}

let lineBuffer = '';
let latestValue = 0;
let encoder;

async function serialWrite(data) {
	encoder = new TextEncoder();
	const dataArrayBuffer = encoder.encode(data);
  vscode.postMessage({
    type: 'stdin',
    value: dataArrayBuffer
  });
}

(function () {
  window.onload = function() {
    var size = calculateSize(self);
    // @ts-ignore
    term = new Terminal({
      cols: size[0],
      rows: size[1],
      useStyle: true,
      screenKeys: true,
      cursorBlink: false
    });
    term.open(document.getElementById("terminal"));
    term.on('data', function(data) {
      serialWrite(data);
  });
  };
  window.addEventListener('resize', function() {
      var size = calculateSize(self);
      term.resize(size[0], size[1]);
  });
  // @ts-ignore
  vscode = acquireVsCodeApi();
  const oldState = vscode.getState() || {};
  window.addEventListener('message', event => {
      const message = event.data; // The json data that the extension sent
      switch (message.type) {
        case 'connected':
          if (message.value) {
            term.write('\x1b[31mConnected success !\x1b[m\r\n');
          }
          break;
        case 'stdout':
          if (message.value) {
            term.write(message.value);
          }
          break;
        default:
          break;
      }
  });
}());


