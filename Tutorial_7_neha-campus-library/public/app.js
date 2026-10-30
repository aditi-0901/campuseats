// Campus Library frontend: real GraphQL data, safe DOM rendering, and local discovery controls.
const API = 'http://localhost:4000/';
const shelvesEl = document.getElementById('shelves');
const statusEl = document.getElementById('status');
const authorSelect = document.getElementById('authorId');
const searchInput = document.getElementById('searchInput');
const yearFilter = document.getElementById('yearFilter');
const clearSearch = document.getElementById('clearSearch');
let authors = [];

async function gql(query, variables) {
  let res;
  try { res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }) }); }
  catch { throw new Error('Cannot reach the library API. Is the GraphQL server running?'); }
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}
function el(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
function say(message, kind) { statusEl.textContent = message; statusEl.className = `status ${kind || ''}`; }
function initials(name) { return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(); }
function filteredAuthors() {
  const term = searchInput.value.trim().toLowerCase();
  const year = yearFilter.value;
  return authors.map((author) => ({ ...author, books: author.books.filter((book) => (!year || String(book.year) === year) && (!term || author.name.toLowerCase().includes(term) || book.title.toLowerCase().includes(term))) })).filter((author) => author.books.length || (!term && !year));
}
function renderBook(book) {
  const card = el('article', 'book-card');
  card.append(el('div', 'book-cover'), el('span', 'book-label', 'IN THE COLLECTION'), el('h4', 'book-title', book.title));
  const bottom = el('div', 'book-bottom');
  bottom.append(el('span', 'book-year', book.year ? String(book.year) : 'Year not listed'));
  const del = el('button', 'delete-book', '×'); del.type = 'button'; del.setAttribute('aria-label', `Delete ${book.title}`); del.addEventListener('click', () => removeBook(book)); bottom.append(del);
  card.append(bottom); return card;
}
function render() {
  const visible = filteredAuthors();
  const total = visible.reduce((sum, author) => sum + author.books.length, 0);
  document.getElementById('resultCount').textContent = `${total} ${total === 1 ? 'title' : 'titles'} shown`;
  shelvesEl.replaceChildren();
  if (!visible.length || !total) { shelvesEl.append(el('div', 'empty-state', searchInput.value || yearFilter.value ? 'No titles match your search. Try another phrase or year.' : 'No titles in the collection yet.')); return; }
  visible.forEach((author, index) => {
    const section = el('section', 'shelf-block');
    const head = el('div', 'shelf-head');
    head.append(el('span', 'author-index', String(index + 1).padStart(2, '0')), el('span', 'author-monogram', initials(author.name)));
    const heading = el('div'); heading.append(el('h3', '', author.name)); heading.append(el('span', 'meta', `${author.country || 'Independent collection'} · ${author.books.length} ${author.books.length === 1 ? 'title' : 'titles'}`)); head.append(heading);
    section.append(head); const grid = el('div', 'book-grid'); author.books.forEach((book) => grid.append(renderBook(book))); section.append(grid); shelvesEl.append(section);
  });
}
function populateControls() {
  const chosen = authorSelect.value; authorSelect.replaceChildren(...authors.map((author) => { const option = el('option', '', author.name); option.value = author.id; return option; }));
  if (chosen) authorSelect.value = chosen;
  const years = [...new Set(authors.flatMap((author) => author.books.map((book) => book.year).filter(Boolean)))].sort((a, b) => b - a);
  yearFilter.replaceChildren(el('option', '', 'All years')); yearFilter.firstChild.value = ''; years.forEach((year) => { const option = el('option', '', String(year)); option.value = year; yearFilter.append(option); });
}
async function load() {
  const data = await gql('{ authors { id name country books { id title year } } }');
  authors = data.authors; document.getElementById('authorCount').textContent = authors.length;
  const books = authors.flatMap((author) => author.books); document.getElementById('bookCount').textContent = books.length;
  const years = books.map((book) => book.year).filter(Boolean); document.getElementById('yearRange').textContent = years.length ? `${Math.min(...years)}–${Math.max(...years)}` : '—';
  populateControls(); render();
}
document.getElementById('bookForm').addEventListener('submit', async (event) => {
  event.preventDefault(); const form = event.target; const button = form.querySelector('button'); const yearText = document.getElementById('year').value.trim(); button.disabled = true;
  try { await gql('mutation ($t: String!, $y: Int, $a: ID!) { addBook(title: $t, year: $y, authorId: $a) { id } }', { t: document.getElementById('title').value, y: yearText ? Number(yearText) : null, a: authorSelect.value }); form.reset(); await load(); say('The new title has joined the shelves.', 'ok'); document.getElementById('collection').scrollIntoView({ behavior: 'smooth' }); } catch (error) { say(error.message, 'error'); } finally { button.disabled = false; }
});
document.getElementById('authorForm').addEventListener('submit', async (event) => {
  event.preventDefault(); const form = event.target; const button = form.querySelector('button'); button.disabled = true;
  try { await gql('mutation ($n: String!, $c: String) { addAuthor(name: $n, country: $c) { id } }', { n: document.getElementById('name').value, c: document.getElementById('country').value }); form.reset(); await load(); say('A new voice has been added.', 'ok'); } catch (error) { say(error.message, 'error'); } finally { button.disabled = false; }
});
async function removeBook(book) { if (!window.confirm(`Remove "${book.title}" from the collection?`)) return; try { await gql('mutation ($id: ID!) { deleteBook(id: $id) }', { id: book.id }); await load(); say('Title removed from the shelves.', 'ok'); } catch (error) { say(error.message, 'error'); } }
searchInput.addEventListener('input', render); yearFilter.addEventListener('change', render); clearSearch.addEventListener('click', () => { searchInput.value = ''; yearFilter.value = ''; render(); searchInput.focus(); });
document.querySelector('.menu-toggle').addEventListener('click', (event) => { const nav = document.getElementById('siteNav'); const open = nav.classList.toggle('open'); event.currentTarget.setAttribute('aria-expanded', open); });
document.querySelectorAll('.site-nav a').forEach((link) => link.addEventListener('click', () => document.getElementById('siteNav').classList.remove('open')));
load().catch((error) => { shelvesEl.replaceChildren(); say(error.message, 'error'); });
