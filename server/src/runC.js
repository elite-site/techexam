const { execFile, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORK = '/tmp/elite_runs';
const COMPILE_TIMEOUT = 10000;
const RUN_TIMEOUT = 5000;
const MAX_OUTPUT = 512 * 1024;

try { fs.mkdirSync(WORK, { recursive: true }); } catch (e) {}

// gcc prints errors as `file.c:LINE:COL: error: message`. We intentionally drop
// the file/line/column prefix so the student never sees the exact erroring line.
function stripLineRefs(stderr) {
  return String(stderr)
    .split(/\r?\n/)
    .filter(function(l) { return /error/i.test(l); })
    .map(function(l) {
      return l.trim().replace(/^[^:]+\.c:\d+:\d+:\s*/, '').replace(/^error:\s*/i, '').trim();
    })
    .filter(Boolean);
}

function normalize(s) {
  return String(s).toLowerCase().replace(/\s+/g, ' ').trim();
}

function stripAll(s) {
  return String(s).toLowerCase().replace(/\s+/g, '');
}

// Mask heap addresses (0x... hex, or long decimal from %d of a pointer) so a
// reference run and a student run compare equal apart from the address value.
function maskAddrs(s) {
  return String(s).replace(/0x[0-9a-fA-F]+/g, '#').replace(/\b\d{7,}\b/g, '#');
}

function matches(actual, contains) {
  var n = normalize(actual);
  if (!contains || !contains.length) return true;
  for (var i = 0; i < contains.length; i++) {
    if (n.indexOf(normalize(contains[i])) === -1) return false;
  }
  return true;
}

function runBinary(bin, input) {
  return new Promise(function(resolve) {
    var child = spawn(bin, [], { stdio: ['pipe', 'pipe', 'pipe'] });
    var stdout = '';
    var stderr = '';
    var killed = false;
    var done = false;
    var timer = setTimeout(function() {
      killed = true;
      try { child.kill('SIGKILL'); } catch (e) {}
    }, RUN_TIMEOUT);
    child.stdout.on('data', function(d) { if (stdout.length < MAX_OUTPUT) stdout += d; });
    child.stderr.on('data', function(d) { if (stderr.length < 65536) stderr += d; });
    child.on('error', function() {
      if (done) return; done = true; clearTimeout(timer);
      resolve({ kind: 'runtime', text: 'program could not be executed' });
    });
    child.on('close', function(code, signal) {
      if (done) return; done = true; clearTimeout(timer);
      if (killed || signal === 'SIGKILL' || signal === 'SIGTERM') {
        return resolve({ kind: 'runtime', text: 'time limit exceeded while running' });
      }
      if (signal === 'SIGSEGV') {
        return resolve({ kind: 'runtime', text: 'segmentation fault (invalid memory access)' });
      }
      if (signal === 'SIGFPE') {
        return resolve({ kind: 'runtime', text: 'floating point exception (e.g. division by zero)' });
      }
      if (signal === 'SIGABRT') {
        return resolve({ kind: 'runtime', text: 'program aborted at runtime' });
      }
      if (signal) {
        return resolve({ kind: 'runtime', text: 'program crashed during execution (' + signal + ')' });
      }
      if (code !== 0) {
        return resolve({ kind: 'runtime', text: 'program exited with a non-zero status' });
      }
      resolve({ output: stdout, stderr: stderr });
    });
    try {
      child.stdin.on('error', function() {});
      child.stdin.write(input || '');
      child.stdin.end();
    } catch (e) {}
  });
}

function compileAndRun(code, input) {
  return new Promise(function(resolve) {
    var id = 'q_' + Date.now() + '_' + Math.floor(Math.random() * 1e9);
    var src = path.join(WORK, id + '.c');
    var bin = path.join(WORK, id);
    try { fs.writeFileSync(src, code); } catch (e) {
      return resolve({ kind: 'runtime', text: 'could not prepare code file' });
    }
    execFile('gcc', ['-w', '-O1', '-std=c11', '-o', bin, src], { timeout: COMPILE_TIMEOUT }, function(err, _stdout, stderr) {
      if (err && err.killed) {
        fs.unlink(src, function() {});
        return resolve({ kind: 'compilation', text: 'compilation timed out' });
      }
      if (err) {
        fs.unlink(src, function() {});
        var msgs = stripLineRefs(stderr);
        var top = (msgs[0] || 'compilation failed').slice(0, 200);
        return resolve({ kind: 'compilation', text: top });
      }
      runBinary(bin, input).then(function(r) {
        fs.unlink(src, function() {});
        fs.unlink(bin, function() {});
        resolve(r);
      });
    });
  });
}

function runC(code, meta) {
  return new Promise(function(resolve) {
    var safe = code || '';
    if (typeof safe !== 'string' || safe.trim() === '') {
      return resolve({ result: 'Error', console: { kind: 'runtime', text: 'no code to run' } });
    }
    if (safe.length > 8000) {
      return resolve({ result: 'Error', console: { kind: 'runtime', text: 'code too large to run' } });
    }
    var input = meta && meta.input;
    compileAndRun(safe, input).then(function(r) {
      if (r.kind) return resolve({ result: 'Error', console: { kind: r.kind, text: r.text } });
      var check = function(ok, out) {
        if (!ok) return resolve({ result: 'Error', console: { kind: 'logical', text: 'program runs, but the output is not the expected result' } });
        var shown = String(out).slice(0, 4000);
        return resolve({ result: 'Correct', console: { kind: 'output', text: shown.length ? shown : '(no output)' } });
      };
      var normCode = stripAll(safe);
      if (meta && meta.forbidden && meta.forbidden.length) {
        for (var f = 0; f < meta.forbidden.length; f++) {
          if (normCode.indexOf(stripAll(meta.forbidden[f])) !== -1) {
            return resolve({ result: 'Error', console: { kind: 'logical', text: 'program runs, but the output is not the expected result' } });
          }
        }
      }
      if (meta && meta.canonical) {
        compileAndRun(meta.canonical, input).then(function(exp) {
          if (exp.kind || exp.output == null) {
            return resolve({ result: 'Error', console: { kind: 'runtime', text: 'could not verify the expected output' } });
          }
          check(normalize(maskAddrs(r.output)) === normalize(maskAddrs(exp.output)), r.output);
        });
        return;
      }
      check(!(meta && meta.contains) || matches(r.output, meta.contains), r.output);
    });
  });
}

module.exports = runC;