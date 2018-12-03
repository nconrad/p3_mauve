
const axios = require('axios');
const fs = require('fs');
const process = require('process');

const DEFAULT_ENDPOINT = 'https://p3.theseed.org/services/data_api';

const fastaOpts = {
  responseType: 'stream',
  headers: {
    'accept': 'application/dna+fasta',
    'authorization': process.env.KB_AUTH_TOKEN || ''
  }
}

const streamOpts = {
  responseType: 'stream',
  headers: {
    'accept': 'application/json',
    'authorization': process.env.KB_AUTH_TOKEN || ''
  }
}

async function getFeatureMeta({endpoint, genomeIDs, outDir}) {
  genomeIDs = Array.isArray(genomeIDs) ? genomeIDs : [genomeIDs];

  let paths = [];

  // for each id, fetch features to file
  for (const id of genomeIDs) {
    console.log(`Fetching genome: ${id}`)
    try {
      let url = `${endpoint || DEFAULT_ENDPOINT}/genome_feature/?eq(genome_id,${id})&limit(25000)`;
      await axios.get(url, streamOpts)
        .then(res => {
          let path = `${outDir}/${id}-features.json`;
          console.log(`Writing ${path}...`);
          res.data.pipe(fs.createWriteStream(path));
          paths.push(path)
          return;
        })
    } catch(err) {
      console.error(
        'Error fetching features from Data API:',
        'message' in err ? err.message : err
      );
      console.error('Ending.');
      process.exit(1);
    }
  }

  return paths;
}

const contigMetaList = [
  "topology", "gi", "accession", "length",
  "sequence_id", "gc_content", "chromosome", "owner",
  "sequence_type", "chromosome", "description"
]

async function getContigMeta({endpoint, genomeIDs, outDir, suffix}) {
  genomeIDs = Array.isArray(genomeIDs) ? genomeIDs : [genomeIDs];

  let paths = [];

  for (const id of genomeIDs) {
    console.log(`Fetching genome: ${id}`)
    try {
      let url = `${endpoint || DEFAULT_ENDPOINT}/genome_sequence/` +
        `?eq(genome_id,${id})&select(${contigMetaList.join(',')})&sort(-length)&limit(25000)`;
      await axios.get(url, streamOpts)
        .then(res => {
          let path = `${outDir}/${id}` + (suffix ? `.${suffix}` : '')  + `-sequences.json`;
          console.log(`Writing ${path}...`);
          res.data.pipe(fs.createWriteStream(path));
          paths.push(path)
          return;
        })
    } catch(err) {
      console.error(
        'Error fetching genome from Data API:',
        'message' in err ? err.message : err
      );
      console.error('Ending.');
      process.exit(1);
    }
  }

  return paths;
}


async function getGBKs({genomeIDs, outDir, suffix}) {
  let paths = [];
  for (genomeID of genomeIDs) {
    let path = await getGBK({genomeID, outDir, suffix});
    paths.push(path);
  }
  return paths;
}


async function getGBK({genomeID, outDir, suffix}) {
  console.log(`Fetching GTO for ${genomeID}...`);
  try {
    await spawnPromise('p3-gto', [genomeID, '-o', outDir]);
  } catch (e) {
    console.error('Error fetching GTO.', e);
  }

  console.log(`Creating .gbk file for ${genomeID}...`);
  let gbkPath;
  try {
    gbkPath = `${outDir}/${genomeID}${suffix ? `.${suffix}` : ''}.gbk`;
    await spawnPromise('rast-export-genome',
      ['-i', `${outDir}/${genomeID}.gto`, '-o', gbkPath, 'genbank']);
  } catch (e) {
    console.error('Error exporting to GBK.', e);
  }

  return gbkPath;
}


async function getGenomeFastas({endpoint, genomeIDs, outDir, suffix} ) {
  genomeIDs = Array.isArray(genomeIDs) ? genomeIDs : [genomeIDs];

  let paths = [];

  // for each id, fetch fasta
  for (const id of genomeIDs) {
    console.log(`Fetching genome: ${id}`)
    try {
      let url = `${endpoint || DEFAULT_ENDPOINT}/genome_sequence/?eq(genome_id,${id})` +
        `&sort(-length,+sequence_id)&limit(25000)`;

      await axios.get(url, fastaOpts)
        .then(res => {
          let path = `${outDir}/${id}` + (suffix ? `.${suffix}` : '')  + `.fasta`;
          console.log(`Writing ${path}...`);
          res.data.pipe(fs.createWriteStream(path));
          paths.push(path)
          return;
        })
    } catch(err) {
      console.error(
        'Error fetching genome from Data API:',
        'message' in err ? err.message : err
      );
      console.error('Ending.');
      process.exit(1);
    }
  }

  return paths;
}


module.exports = {
  getGenomeFastas,
  getFeatureMeta,
  getContigMeta,
  getGBKs
}

