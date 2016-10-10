var ParseDiff = require('parse-diff');
var MDRenderer = require('.');
var Git = require('../git');
var Utils = require('../utils');

/*
  Renders step diff in a pretty markdown format. For example {{{diff_step 1.1}}}
  will render as:

  [{]: <helper> (diff_step 1.1)
  #### Step 1.1

  ##### Changed /path/to/file.js
  ```diff
  @@ -1,3 +1,3 @@
  +┊ ┊1┊foo
  -┊1┊ ┊bar
   ┊2┊2┊baz🚫↵
  ```
  [}]: #
 */

MDRenderer.registerHelper('diff_step', function(step) {
  var stepData = Git.recentCommit([
    '--grep=^Step ' + step, '--format=%h %s'
  ]).split(' ')
    .filter(Boolean);

  // In case step doesn't exist just render the error message.
  // It's better to have a silent error like this rather than a real one otherwise
  // the rebase process will skrew up very easily and we don't want that
  if (!stepData.length) return '#### Step ' + step + ': NOT FOUND!';

  var stepHash = stepData[0];
  var stepMessage = stepData.slice(1).join(' ');

  var stepTitle = '#### ' + stepMessage;
  var diff = Git(['diff', stepHash + '^', stepHash]);
  // Convert diff string to json format
  var files = ParseDiff(diff);

  var mdDiffs = files
    .map(getMdDiff)
    .join('\n\n');

  return stepTitle + '\n\n' + mdDiffs;
});

// Gets all diff chunks in a markdown format for a single file
function getMdDiff(file) {
  var fileTitle;

  if (file.new)
    fileTitle = '##### Added ' + file.to;
  else if (file.deleted)
    fileTitle = '##### Deleted ' + file.from;
  else
    fileTitle = '##### Changed ' + file.from;

  var mdChunks = file.chunks
    .map(getMdChunk)
    .join('\n');

  return fileTitle + '\n' + mdChunks;
}

// Gets diff in a markdown format for a single chunk
function getMdChunk(chunk) {
  // Grab chunk data since it's followed by unrelevant content
  var chunkData = chunk.content.match(/^@@\s+\-(\d+),?(\d+)?\s+\+(\d+),?(\d+)?\s@@/)[0];

  var changes = chunk.changes;
  var lastChange = changes[changes.length - 1];

  // The padding of the line numbers would be determined by the line number
  var lastLineNumber = Math.max(
    lastChange.ln || 0,
    lastChange.ln1 || 0,
    lastChange.ln2 || 0
  );

  var padLength = lastLineNumber.toString().length;

  var mdChanges = chunk.changes
    .map(getMdChange.bind(null, padLength))
    .join('\n')
    // Replace EOF flag with a pretty format and append it to the recent line
    .replace('\n\\ No newline at end of file', '🚫↵');

  // Wrap changes with markdown 'diff'
  return ['```diff', chunkData, mdChanges, '```'].join('\n');
}

// Gets line in a markdown format for a single change
function getMdChange(padLength, change) {
  // No newline at end of file
  if (change.content[0] == '\\') return change.content;

  var addLineNum = '';
  var delLineNum = '';
  var sign = '';

  switch (change.type) {
    case 'add':
      sign = '+';
      addLineNum = change.ln;
      break;

    case 'del':
      sign = '-';
      delLineNum = change.ln;
      break;

    case 'normal':
      sign = ' ';
      addLineNum = change.ln2;
      delLineNum = change.ln1;
      break;
  }

  addLineNum = Utils.pad(addLineNum, padLength);
  delLineNum = Utils.pad(delLineNum, padLength);

  // Using content.slice(1) since we want to remove '-\+' prefixes
  return [sign, delLineNum, addLineNum, change.content.slice(1)].join('┊');
}