# The chat's end-to-end encryption (round 3, 2026-11-27)

Josh's choice: "Messages, photos, videos and voice notes are scrambled on your phones before they're
sent. The server and database only ever see gibberish. Notification previews still show the text,
because the phone unscrambles them. A device signed in with the right passphrase can read
everything. If both passphrases were ever lost, old messages couldn't be recovered."

## Keys

- **Each person has a P-256 key pair**, made on their own device the first time they type their
  passphrase (sign-in hands it over in memory: `src/lib/session.js` → `rememberPassphrase`).
- **The private key is wrapped** with AES-256-GCM under a key stretched from the passphrase:
  PBKDF2-SHA256, 600 000 rounds (OWASP's figure), a random 16-byte salt, the role as additional
  data. The passphrase is normalised exactly as sign-in does (`server/auth/passphrase.js`). The
  server stores the wrapped key and the public key (`kv` rows `chatkeys:identity:<role>`); it never
  has the passphrase-derived key. PBKDF2 was chosen over Argon2id because it is built into
  WebCrypto on both iOS WebKit and Node (no WASM to ship or fail to load); the blob records its KDF
  and round count, so a stronger KDF can replace it at the next passphrase entry.
- **The chat key** is HKDF-SHA256 over ECDH(mine, theirs); both phones compute it on their own, so
  neither has to be online for the other. Its id names the two public keys (`keyIdOf`).
- **On a device** the private key and chat keys live in IndexedDB as non-extractable `CryptoKey`s.
  In the iPhone app the private key (pkcs8) also goes into the Keychain (this device only, never
  synced) and the chat key into a Keychain item whose access group is the App Group
  `group.love.kiriya.app`, so the notification extension and widgets can read it. A phone that opens
  with Face ID never needs the passphrase again; a fresh device asks once (`lock/useChatRoom.jsx`).
- **Passphrase change** (`PUT /me/passphrase` with `chatKey`): the same key pair, wrapped again under
  the new passphrase, stored with the change.
- **Admin reset of her passphrase**: her old blob no longer opens, so her next device makes a new
  key pair (`replace`), keeping the old public key in `previous`. Josh's phone derives both the old
  and new chat keys and re-seals old messages with the new one (the history pass below). If only one
  passphrase is lost, nothing is lost; if both are, old messages can't be opened.
- **Safety code**: six emoji from the key id, in the design sheet's privacy tab. The same code on
  both phones means no one swapped a public key in between.

## Formats (`src/lib/chatCrypto/core.js`; Swift: `ios/App/KiriyaShared/KiriyaChatCrypto.swift`)

- sealed value: `base64url(iv[12] ‖ ciphertext ‖ tag[16])`, AES-256-GCM, fresh random IV.
- AAD: `kiriya.love/chat/v1|<field>|<sender>|<kind>` (`field`: message, media, notify), so a
  message can't be re-attributed or passed off as another kind. The plaintext carries the clientId
  (`{ c, t }`), checked when the message's clientId is known, so it can't be moved to another row.
- plaintext padded with spaces to 32-byte steps.
- message on the wire: `body` = sealed `{ c, t }`; `enc` = `{ v: 1, k: keyId, n?: sealed preview }`;
  media entries keep only layout facts plain (url, width, height, duration, mime, type); file keys,
  alt text, voice waveforms, and a GIF's or sticker's links go in each entry's `sealed`.
- files: each photo, video, poster and voice note has its own random AES-256-GCM key; the uploaded
  bytes are `iv ‖ ciphertext ‖ tag` (`application/octet-stream`), and the key travels inside the
  sealed message. Her chat background photo is sealed the same way (`prefs.backgroundKey`).
- signals ("thinking of you" taps) stay plain: their body is one of seven known keys.

## What the server still sees

Who sent what kind of message when, reactions (emoji), read times, reply links, taps, the number of
photos in an album and their sizes, voice note and video lengths, and the opaque blobs. Letters,
little notes and jar notes are not part of the chat and stay as they were.

## Before both keys exist, and the history pass

Until her key pair exists, messages pass through plain (`enc` null). Once both exist, the server
refuses plain messages and edits (`refusePlain`), and any device holding the key seals what is
still plain, or on a retired key, in place: `src/lib/chatCrypto/history.js` → `GET
/me/chat/keys/pending`, `POST /me/chat/keys/claim` (a 3-minute lease), `POST /me/chat/keys/sealed`.
Plain files are fetched, sealed, uploaded again, and the plain copy is deleted once no message or
memory points at it. Each row is written only if it is still what the device read.

## Notifications and widgets

The server sends `title: <name>`, `body: "a new message ♡"`, `mutable-content` and `sealed: { k,
s, t, c, n }`. The notification service extension opens `n` with the Keychain's chat key and shows
the words, unless the chat lock hides previews (App Group flag `chatHidePreviews`). Web push can only
say "a new message ♡". The widget snapshot's last message is sealed the same way
(`ChatLast.words`). A Reply typed into a notification is sealed natively before it goes.

## Threat model, plainly

- **A database dump or backup, Blob storage, logs, Ably, Apple's push service**: only ciphertext,
  public keys and passphrase-wrapped private keys. Reading anything means guessing a passphrase at
  600 000 PBKDF2 rounds per guess, so a long passphrase matters.
- **Someone running code on the live server** (a compromised deploy or Vercel account): the server
  receives the raw passphrase at sign-in (`/session/unlock`), so it could capture it on the next
  passphrase sign-in and unwrap that person's key. Worse, the same server ships the website's code
  and the app's over-the-air updates, so it could ship code that reads the keys on the phone. End to
  end encryption in a web app can't defend against the party that serves the code.
- **Sending a derived value instead of the raw passphrase** at sign-in would only stop a server that
  logs request bodies passively. It needs a sign-in migration (the stored scrypt hashes are of the
  raw phrase), so it isn't worth it now; it would pair well with pinning the app's web bundle
  (signed updates) if that ever becomes the next step.

## Tests

`scripts/test-chat-crypto.mjs` runs the client modules as separate "devices" against the real API
(PGlite, network off): both directions, replies, edits, albums with videos and posters, voice notes,
GIFs, the push payload (size and contents), the widget, memories, a notification reply sealed the
way Swift does it, a fresh device, Josh's preview of her side, a passphrase change, an admin reset,
the history pass (files included), wrong keys and tampering failing safely, and a database dump with
nothing readable. Swift ↔ JS interop was checked by hand (2026-11-27): each opens the other's
messages and refuses a wrong sender.
