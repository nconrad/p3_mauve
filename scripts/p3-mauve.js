#!/usr/bin/env node

/**
 * Given patric IDs, downloads Fastas and runs Mauve
 *
 *  Ex:
 *
 *    ./p3-mauve.js -g 204722.5,224914.11,262698.4,359391.4 -o test-data/
 *    ./p3-mauve.js -g 520459.3,520461.7,568815.3 -t
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
const axios = require('axios');
const util = require('util');
const { spawn } = require('child_process');
const tmp = require('tmp-promise');
const mauveParser = require('./mauve-parser');


// const mkdir = util.promisify(fs.mkdir);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);


const DEFAULT_ENDPOINT = 'https://www.patricbrc.org/api/';

const streamOpts = {
  responseType: 'stream',
  headers: {
    'accept': 'application/dna+fasta',
    'authorization': process.env.KB_AUTH_TOKEN || ''
  }
}

if (require.main === module) {
  opts.option('-g, --genome-ids [value]', 'Genome IDs comma delimited')
    .option('--jstring [value]', 'Pass job params (json) as string')
    .option('--jfile [value]', 'Pass job params (json) as file')
    .option('--sstring [value]', 'Server config (json) as string')
    .option('-o, --output [value]', 'Where to save files/results')
    .option('-t, --tmp-files', 'Use temp files for fastas')

    .option('--seed-weight [value]', 'Mauve option: ' +
      'Use the specified seed weight for calculating initial anchors')
    .option('--hmm-p-go-homologous [value]', 'Mauve option: ' +
      'Probability of transitioning from the unrelated to the homologous state [0.0001]')
    .option('--hmm-p-go-unrelated [value]', 'Mauve option: ' +
      'Probability of transitioning from the homologous to the unrelated state [0.000001]')
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

  // get server config
  let endpoint;
  if (opts.sstring) {
    try {
      let apiURL = JSON.parse(opts.sstring).data_api;
      endpoint = `${apiURL}/genome_sequence/?sort(-length)&limit(1000000000)`;
    } catch(e) {
      console.log('Error parsing server config (--sstring).');
      process.exit(1);
    }
  }

  let useTmpFiles = opts.tmpFiles,   // use system scratch space
      outDir = opts.output;


  // mauve specific options
  let mauveOpts = {
    'hmm-p-go-homologous': params.hmmPGoHomologous,
    'hmm-p-go-unrelated': params.hmmPGoUnrelated,
    'seed-weight': params.seedWeight
  };

  console.log('Fetching genomes...')
  let fastaPaths = await getGenomes({
    genomeIDs,
    useTmpFiles,
    outDir,
    endpoint
  });

  console.log('Running Mauve...')
  let xmfaPath;
  try {
    xmfaPath = await runMauve(fastaPaths, mauveOpts, outDir);
  } catch (e) {
    console.error('Error running Mauve:', error.message);
    console.error('Ending.');
    process.exit(1);
  }
}


async function getGenomes(params) {
  let {genomeIDs, useTmpFiles, outDir, endpoint} = params;
  genomeIDs = Array.isArray(genomeIDs) ? genomeIDs : [genomeIDs];

  let paths = [];

  // for each id, fetch fasta, store in tmp directory (unless useTmpFiles=false)
  for (const id of genomeIDs) {
    console.log(`Fetching genome: ${id}`)
    try {
      await axios.get(`${endpoint || DEFAULT_ENDPOINT}&eq(genome_id,${id})`, streamOpts)
        .then(res => {

          // if not using tmp files, just write to provided output directory
          if (!useTmpFiles) {
            let path = `${outDir}/${id}.fasta`;
            console.log(`Writing ${path}...`);
            res.data.pipe(fs.createWriteStream(path));
            paths.push(path)
            return;
          }

          // otherwise create tmp file in system tmpdir and stream to it
          return tmp.file({postfix: `-${id}.fasta`}).then(function(obj) {
            let path = obj.path;
            console.log(`Writing ${path}...`);
            res.data.pipe(fs.createWriteStream(path));
            paths.push(path)
          }).catch(e => {
            throw e ;
          })
        })
    } catch(error) {
      console.error('Error fetching genome from Data API:', error.message);
      console.error('Ending.');
      process.exit(1);
    }
  }

  return paths;
}


async function runMauve(paths, mauveOpts, outDir) {
  let opts = [];
  for (opt in mauveOpts) {
    let val = mauveOpts[opt];
    if (!val) continue;

    opts.push(`--${opt}=${val}`);
  }

  let xmfaPath = `${outDir}/alignment.xmfa`;

  let params = [`--output=${xmfaPath}`, ...paths, ...opts];
  console.log(`Running Mauve with params:  ${params}`);
  const mauve = spawn('progressiveMauve', params);

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
      console.error('Error writing alignment JSON:', error.message);
      console.error('Ending.');
      process.exit(1);
    }
  });

  return xmfaPath;
}


/*
async function createDir(path) {
  try {
    await mkdir(path);
  } catch(e) {
    if (e.code !== 'EEXIST')
      console.log('e', e);
  }
}
*/
