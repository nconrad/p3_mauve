/**
 * Helper for parsing xmfa files
 *
 */

const xmfaParser  = require('./xmfa-parser');
const fs = require('fs');
const util = require('util');

const readFile = util.promisify(fs.readFile);

async function parser(path, includeSeqs) {
    let data = await readFile(path, 'utf-8');

    // use parser
    let lcbs = xmfaParser.parse(data);

    // only includes sequences if requested, remove paths (for now)
    if (!includeSeqs) {
        for (let i=0; i < lcbs.length; i++) {
            let lcb = lcbs[i];
            for (let j=0; j < lcb.length; j++ ) {
                let region = lcb[j];
                let name = region.name;
                region.name = name.substr(name.lastIndexOf('/') + 1);
                delete region.seq;
            }
        }
    }

    return lcbs;
}

module.exports = parser;