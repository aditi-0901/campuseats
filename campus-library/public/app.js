// app.js -- talks to the GraphQL API. A GraphQL call is just an HTTP POST.
const API = 'http://localhost:4000/';

const SPINE_COLORS = ['#7a2e3b', '#1f5f5b', '#3b4a7a', '#6b4f1d', '#4a5d3a', '#5a3a62'];

const shelvesEl = document.getElementById('shelves');
const statusEl = document.getElementById('status');
const authorSelect = document.getElementById('authorId');

/* helper: send one query or mutation; throw a readable Error on any failure */
async function gql(query, variables) {
  let res;
  try {
    res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new Error('Cannot reach the API at ' + API + ' - is "node server.js" running?');
  }
  const json = await res.json();
  if (json.errors && json.errors.length) throw new Error(json.errors[0].message);
  return json.data;
}

function say(message, kind) {
  statusEl.textContent = message;
  statusEl.className = 'status ' + (kind || '');
}

/* small DOM helper: text is always set with textContent, never as HTML */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderBook(book) {
  const spine = el('div', 'spine');
  spine.style.background = SPINE_COLORS[book.id % SPINE_COLORS.length];
  spine.style.height = 150 + ((book.id * 37) % 45) + 'px';
  spine.title = book.title + (book.year ? ' (' + book.year + ')' : '');

  spine.append(el('span', book.title.length > 26 ? 'spine-title long' : 'spine-title', book.title));
  if (book.year) spine.append(el('span', 'spine-year', String(book.year)));

  const del = el('button', 'spine-delete', '\u00d7');
  del.type = 'button';
  del.setAttribute('aria-label', 'Delete ' + book.title);
  del.addEventListener('click', () => removeBook(book));
  spine.append(del);
  return spine;
}

function renderAuthor(author) {
  const block = el('section', 'shelf-block');

  const head = el('div', 'shelf-head');
  head.append(el('h2', '', author.name));
  const count = author.books.length;
  const parts = [];
  if (author.country) parts.push(author.country);
  parts.push(count === 1 ? '1 book' : count + ' books');
  head.append(el('span', 'meta', parts.join(', ')));

  const shelf = el('div', 'shelf');
  if (count === 0) shelf.append(el('span', 'empty-shelf', 'No books yet. Add the first one.'));
  author.books.forEach((b) => shelf.append(renderBook(b)));

  block.append(head, shelf);
  return block;
}

/* READ: one query returns every author with the title and year of each book */
async function load() {
  const data = await gql('{ authors { id name country books { id title year } } }');
  shelvesEl.replaceChildren(...data.authors.map(renderAuthor));
  if (data.authors.length === 0) shelvesEl.append(el('p', 'note', 'No authors yet. Add one on the right.'));

  const chosen = authorSelect.value;
  authorSelect.replaceChildren(
    ...data.authors.map((a) => {
      const opt = el('option', '', a.name);
      opt.value = a.id;
      return opt;
    })
  );
  if (chosen) authorSelect.value = chosen;
}

/* WRITE: add a book */
document.getElementById('bookForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const button = form.querySelector('button');
  const yearText = document.getElementById('year').value.trim();
  button.disabled = true;
  try {
    await gql(
      `mutation ($t: String!, $y: Int, $a: ID!) {
         addBook(title: $t, year: $y, authorId: $a) { id }
       }`,
      {
        t: document.getElementById('title').value,
        y: yearText === '' ? null : Number(yearText),
        a: authorSelect.value,
      }
    );
    const keep = authorSelect.value;
    form.reset();
    authorSelect.value = keep;
    await load();
    say('Book added.', 'ok');
  } catch (err) {
    say(err.message, 'error');
  } finally {
    button.disabled = false;
  }
});

/* WRITE: add an author */
document.getElementById('authorForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const button = form.querySelector('button');
  button.disabled = true;
  try {
    await gql(
      `mutation ($n: String!, $c: String) { addAuthor(name: $n, country: $c) { id } }`,
      { n: document.getElementById('name').value, c: document.getElementById('country').value }
    );
    form.reset();
    await load();
    say('Author added.', 'ok');
  } catch (err) {
    say(err.message, 'error');
  } finally {
    button.disabled = false;
  }
});

/* WRITE: delete a book */
async function removeBook(book) {
  if (!window.confirm('Delete "' + book.title + '"?')) return;
  try {
    await gql('mutation ($id: ID!) { deleteBook(id: $id) }', { id: book.id });
    await load();
    say('Book deleted.', 'ok');
  } catch (err) {
    say(err.message, 'error');
  }
}

load().catch((err) => {
  shelvesEl.replaceChildren();
  say(err.message, 'error');
});
