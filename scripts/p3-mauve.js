#!/usr/bin/env node

/**
 * Given patric IDs, downloads Fastas and runs Mauve
 *
 *  Ex:
 *
 *    ./p3-mauve.js -g 204722.5,224914.11,262698.4,359391.4 -o ../test-data/
 *    ./p3-mauve.js -g 520459.3,520461.7,568815.3
 *
 *  With Auth:
 *      export KB_AUTH_TOKEN="<auth_token>"
 *      ./p3-mauve.js -g 1262932.43,1262932.44 -o ../test-data/
 *
 *  Author(s):
 *    nconrad
 *
 * Todo: Don't need to store alignment sequences in memory
 *
 */

const opts = require('commander');
const fs = require('fs');
const process = require('process');
const util = require('util');
const { spawn } = require('child_process');
const mauveParser = require('./mauve-parser');

const utils = require('./utils');

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

if (require.main === module) {
  opts.option('-g, --genome-ids [value]', 'Genome IDs comma delimited')
    .option('--jstring [value]', 'Pass job params (json) as string')
    .option('--jfile [value]', 'Pass job params (json) as file')
    .option('--sstring [value]', 'Server config (json) as string')
    .option('-o, --output [value]', 'Where to save files/results')
    .option('-s, --suffix [value]', 'Suffix to append to sequence file names')
    .option('-n, --no-mauve', 'Just fetch data')

    .option('--seed-weight [value]', 'Mauve option: ' +
      'Use the specified seed weight for calculating initial anchors')
    .option('--hmm-p-go-homologous [value]', 'Mauve option: ' +
      'Probability of transitioning from the unrelated to the homologous state [0.0001]')
    .option('--hmm-p-go-unrelated [value]', 'Mauve option: ' +
      'Probability of transitioning from the homologous to the unrelated state [0.000001]')
    .option('--recipe', 'Use progressiveMauve or mauveAligner algorithm (defaults to progressiveMauve)')
    .parse(process.argv)

  patricMauve(opts);
}


async function patricMauve(opts) {
  let params, genomeIDs;
  // if job description file
  if (opts.jfile) {
    let jfile = await readFile(opts.jfile)
    params = JSON.parse(jfile);
    genomeIDs = params.genome_ids;

  // if job description string
  } else if (opts.jstring) {
    params = JSON.parse(opts.jstring);
    genomeIDs = params.genome_ids;

  // otherwise, use --genome-ids
  } else {
    params = opts;
    genomeIDs = params.genomeIds.split(',');
  }

  validateParams(params);

  // get server config
  let endpoint;
  if (opts.sstring) {
    try {
      endpoint = JSON.parse(opts.sstring).data_api;
    } catch(e) {
      console.log('Error parsing server config (--sstring).');
      process.exit(1);
    }
  }

  let outDir = opts.output,
      suffix = opts.suffix;

  // mauve specific options
  let mauveOpts = {
    'hmm-p-go-homologous': params.hmmPGoHomologous,
    'hmm-p-go-unrelated': params.hmmPGoUnrelated,
    'seed-weight': params.seedWeight
  };

  console.log('Fetching genomes...')
  let paths = await utils.getGenomeFastas({
    endpoint,
    genomeIDs,
    outDir,
    suffix
  });

  if (!opts.mauve) return;

  console.log('Running Mauve...')
  try {
    await runMauve(params.recipe, paths, mauveOpts, outDir);
  } catch (e) {
    console.error('Error running Mauve:', e.message);
    console.error('Ending.');
    process.exit(1);
  }
}


function validateParams(p) {
  if (p.recipe && !['progressiveMauve', 'mauveAligner'].includes(p.recipe)) {
    console.error(`\nInvalid recipe: ${p.recipe}`);
    process.exit(1);
  }

  if (p.genomeIds && !p.output) {
    console.error(`\nMust specify output directory path.`);
    opts.help();
    process.exit(1);
  }
}


async function runMauve(recipe, paths, mauveOpts, outDir) {
  let opts = [];
  for (opt in mauveOpts) {
    let val = mauveOpts[opt];
    if (!val) continue;

    opts.push(`--${opt}=${val}`);
  }

  let xmfaPath = `${outDir}/alignment.xmfa`;

  let cmd;
  if (!recipe || recipe === 'progressiveMauve') {
    cmd = 'progressiveMauve';
  } else if (recipe === 'mauveAligner') {
    cmd = 'mauveAligner';
  }

  if (cmd === 'mauveAligner') {
    let allPaths = [];
    paths.forEach(path => {
      allPaths.push(path);
      allPaths.push(path + '.sml')
    })
    paths = allPaths;
  }

  let params = [`--output=${xmfaPath}`, ...paths, ...opts];
  console.log(`Running ${cmd} with params:  ${params.join('\n')}`);
  const mauve = spawn(cmd, params);

  mauve.stdout.on('data', (data) => {
    console.log(`${data}`);
  });

  mauve.stderr.on('data', (data) => {
    console.error(`${data}`)
  });

  mauve.on('close', async (code) => {
    console.log(`child process exited with code ${code}`);

    try {
      let path = xmfaPath.replace('.xmfa', '.json');
      console.log(`Writing Alignment JSON to ${path}...`)
      let alignment = await mauveParser(xmfaPath);
      await writeFile(path, JSON.stringify(alignment, null, 4));
      console.log('Done.');
    } catch (e) {
      console.error('Error writing alignment JSON:', e.message);
      console.error('Ending.');
      process.exit(1);
    }
  });

  return xmfaPath;
}


