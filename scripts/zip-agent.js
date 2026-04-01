import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

const output = fs.createWriteStream(path.join(process.cwd(), 'public', 'PrintAgent.zip'));
const archive = archiver('zip', {
  zlib: { level: 9 }
});

output.on('close', function() {
  console.log(archive.pointer() + ' total bytes');
  console.log('archiver has been finalized and the output file descriptor has closed.');
});

archive.on('error', function(err) {
  throw err;
});

archive.pipe(output);

archive.directory('public/print-agent-source/', 'PrintAgent');

archive.finalize();
