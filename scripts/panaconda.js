/**
 * Experimenting with arrangement of contigs using Panaconda
 *
 *  Ex:
 *    node mauve-parser.js -i ../test-data/alignment.xmfa
 *
 *  Author(s):
 *    nconrad
 *
 */

const fs = require('fs');
const util = require('util');
const { getFeatures } = require('./utils');
const opts = require('commander');

const readFile = util.promisify(fs.readFile);


if (require.main === module) {
    opts.option('-g, --genomeIDs [value]', 'List of genomeIDs')
        .parse(process.argv)

    main(opts);
}

// Needs to be implemented
async function main(opts) {
    let {genomeIDs} = opts;

    genomeIDs = genomeIDs.split(',');

    getFeatures(genomeIDs).then((data) => {
        console.log('data', data)
    })
}
