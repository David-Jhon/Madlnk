const readline = require('readline');
const db = require('./DB/sqlite.js');
const sqlite3 = require('sqlite3').verbose();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper functions
const prompt = (question) => new Promise(resolve => rl.question(question, answer => resolve(answer.trim())));
const confirm = async (message) => (await prompt(`${message} (y/n): `)).toLowerCase() === 'y';
const formatName = (name) => name.replace(/_/g, ' ');
const typeIcon = (isMovie) => isMovie ? '[MOVIE]' : '[SERIES]';
const clear = () => console.clear();

// Database operations with unified handler
const dbOperation = (operation) => new Promise((resolve, reject) => {
  const rawDb = new sqlite3.Database('./data.sqlite');
  operation(rawDb, (err, result) => {
    rawDb.close();
    err ? reject(err) : resolve(result);
  });
});

const updateAnimeType = (animeId, isMovie) => 
  dbOperation((db, cb) => db.run('UPDATE animes SET isMovie = ? WHERE animeId = ?', [isMovie ? 1 : 0, animeId], cb));

const updateAnimeName = (animeId, name) => 
  dbOperation((db, cb) => db.run('UPDATE animes SET name = ? WHERE animeId = ?', [name, animeId], cb));

const deleteAnime = (animeId) => 
  dbOperation((db, cb) => db.run('DELETE FROM animes WHERE animeId = ?', [animeId], cb));

const bulkUpdateSeries = () => 
  dbOperation((db, cb) => db.run('UPDATE animes SET isMovie = 0', cb));

// Display functions
const showHeader = () => {
  clear();
  console.log('Anime Migration Tool');
  console.log('='.repeat(50));
  console.log('Manage your anime database - mark as movies or series\n');
};

const showMenu = () => {
  console.log('Main Menu:');
  console.log('1. Search anime by name');
  console.log('2. Browse all anime');
  console.log('3. Mark all as series (bulk)');
  console.log('4. Exit');
};

const showAnimeList = (animes) => {
  console.log('\nResults:');
  console.log('-'.repeat(60));
  animes.forEach((anime, i) => {
    const episodes = JSON.parse(anime.episodes || '[]').length;
    console.log(`${i + 1}. ${typeIcon(anime.isMovie)} ${formatName(anime.name)} (${episodes} eps)`);
  });
  console.log('-'.repeat(60));
};

const showActions = (anime) => {
  console.log(`\nEditing: "${formatName(anime.name)}" (${typeIcon(anime.isMovie)})`);
  console.log('1. Change type (Movie / Series)');
  console.log('2. Rename anime');
  console.log('3. Delete anime');
  console.log('4. Back to list');
};

// Main handlers
const searchAnime = async () => {
  const term = await prompt('\nEnter anime name to search: ');
  if (!term) return null;
  
  const results = await db.searchAnimeByName(term);
  if (results.length === 0) {
    console.log('No anime found. Try a different search term.');
    await prompt('Press Enter to continue...');
    return null;
  }
  return results;
};

const listAllAnime = async () => {
  const results = await db.getAllAnimes();
  if (results.length === 0) {
    console.log('No anime in database yet.');
    await prompt('Press Enter to continue...');
    return null;
  }
  return results;
};

const bulkUpdateAll = async () => {
  const count = (await db.getAllAnimes()).length;
  if (count === 0) {
    console.log('No anime to update.');
    return;
  }
  
  if (await confirm(`\nMark all ${count} anime as Series?`)) {
    await bulkUpdateSeries();
    console.log('All anime marked as Series!');
  }
  await prompt('Press Enter to continue...');
};

const selectAnime = async (animes) => {
  showAnimeList(animes);
  console.log('\nOptions: Enter number to edit, "all" for bulk update, "back" to return');
  
  const input = await prompt('Your choice: ');
  
  if (input.toLowerCase() === 'back') return { action: 'back' };
  if (input.toLowerCase() === 'all') return { action: 'bulk', animes };
  
  const index = parseInt(input) - 1;
  if (isNaN(index) || index < 0 || index >= animes.length) {
    console.log('Invalid selection!');
    await prompt('Press Enter to try again...');
    return null;
  }
  
  return { action: 'edit', anime: animes[index] };
};

const bulkUpdate = async (animes) => {
  console.log('\nBulk Update Mode:');
  console.log('1. Mark all as Movies');
  console.log('2. Mark all as Series');
  
  const choice = await prompt('Choose (1-2): ');
  const isMovie = choice === '1';
  const type = isMovie ? 'Movies' : 'Series';
  
  if (await confirm(`\nMark all ${animes.length} anime as ${type}?`)) {
    for (const anime of animes) {
      await updateAnimeType(anime.animeId, isMovie);
    }
    console.log(`All ${animes.length} anime marked as ${type}!`);
  }
  await prompt('Press Enter to continue...');
};

const editAnime = async (anime) => {
  while (true) {
    showActions(anime);
    const choice = await prompt('\nChoose action (1-4): ');
    
    switch (choice) {
      case '1':
        const newType = await prompt('Movie (1) or Series (2)? ') === '1';
        const typeName = newType ? 'Movie' : 'Series';
        if (await confirm(`Mark as ${typeName}?`)) {
          await updateAnimeType(anime.animeId, newType);
          anime.isMovie = newType;
          console.log(`Changed to ${typeName}!`);
        }
        break;
        
      case '2':
        const currentName = formatName(anime.name);
        const newName = await prompt(`New name (current: "${currentName}"): `);
        if (newName && await confirm(`Rename to "${newName}"?`)) {
          const formatted = newName.toLowerCase().replace(/\s+/g, '_');
          await updateAnimeName(anime.animeId, formatted);
          anime.name = formatted;
          console.log(`Renamed to "${newName}"!`);
        }
        break;
        
      case '3':
        if (await confirm(`DELETE "${formatName(anime.name)}"? This cannot be undone!`)) {
          await deleteAnime(anime.animeId);
          console.log('Anime deleted!');
          await prompt('Press Enter to continue...');
          return;
        }
        break;
        
      case '4':
        return;
        
      default:
        console.log('Invalid option!');
    }
    
    if (choice !== '4') {
      await prompt('Press Enter to continue...');
    }
  }
};

const processResults = async (results) => {
  while (true) {
    const selection = await selectAnime(results);
    if (!selection) continue;
    
    switch (selection.action) {
      case 'back':
        return;
      case 'bulk':
        await bulkUpdate(selection.animes);
        return;
      case 'edit':
        await editAnime(selection.anime);
        break;
    }
  }
};

// Initialize database
const initDatabase = async () => {
  try {
    await dbOperation((db, cb) => {
      db.run('ALTER TABLE animes ADD COLUMN isMovie BOOLEAN DEFAULT 0', cb);
    });
  } catch (err) {
    if (!err.message.includes('duplicate column')) throw err;
  }
};

// Main application
const main = async () => {
  try {
    await initDatabase();
    
    while (true) {
      showHeader();
      showMenu();
      
      const choice = await prompt('\nEnter your choice (1-4): ');
      
      let results;
      switch (choice) {
        case '1':
          results = await searchAnime();
          if (results) await processResults(results);
          break;
          
        case '2':
          results = await listAllAnime();
          if (results) await processResults(results);
          break;
          
        case '3':
          await bulkUpdateAll();
          break;
          
        case '4':
          console.log('\nThanks for using Anime Migration Tool!');
          rl.close();
          db.close();
          return;
          
        default:
          console.log('Invalid option! Please choose 1-4.');
          await prompt('Press Enter to continue...');
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
    console.log('Restarting...');
    await prompt('Press Enter to continue...');
    await main();
  }
};

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nGoodbye!');
  rl.close();
  db.close();
  process.exit(0);
});

main().catch(console.error);