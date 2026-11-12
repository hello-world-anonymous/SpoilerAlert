# How to install SpoilerAlert (step by step, no coding)

SpoilerAlert is a free Chrome extension that blurs spoilers for whatever you choose: a game, movie, TV show, or sports match. It isn't on the Chrome Web Store yet, so you install it yourself. It takes about 2 minutes.

**You need:** a computer (Mac, Windows, Linux or ChromeOS) with **Google Chrome**. Microsoft Edge, Brave, Opera and Vivaldi work too; see the note under step 3. Phones and tablets can't run Chrome extensions.

---

## Step 1: Download it

1. Go to **https://github.com/hello-world-anonymous/gta6-spoiler-shield**
2. Click the green **Code** button, then **Download ZIP**.

You don't need a GitHub account.

## Step 2: Unzip it and put it somewhere permanent

- **Mac:** double-click the ZIP in your Downloads folder. A folder appears next to it.
- **Windows:** right-click the ZIP → **Extract All…** → **Extract**.

Move the unzipped folder somewhere you won't delete it, like your Documents folder. **Chrome runs the extension from this folder, so if you delete or move it later, the extension stops working.**

Open the folder and check that you can see a file called **manifest.json**. If you instead see a single folder, open that one: the folder with `manifest.json` inside is the one you need.

## Step 3: Load it into Chrome

1. Open Chrome and type **chrome://extensions** into the address bar, then press Enter.
2. Turn on **Developer mode** with the switch in the **top-right** corner.
3. Click **Load unpacked** (top left).
4. Select the folder that contains **manifest.json** and click **Select** (Mac) or **Select Folder** (Windows).

SpoilerAlert now appears in your list of extensions. 🎉

**Other browsers:** Edge uses `edge://extensions` (the Developer mode switch is in the left sidebar), Brave uses `brave://extensions`, Opera uses `opera://extensions`. The rest is the same.

## Step 4: Pin it to your toolbar

Click the **puzzle-piece icon** to the right of the address bar, then the **pin** next to SpoilerAlert. Its icon (a crossed-out eye) now stays in your toolbar. Click it to:

- turn SpoilerAlert on or off,
- switch between **blur**, **hide** and **placeholder** modes,
- see how many spoilers were hidden on the current page,
- reveal everything on the current tab.

## Step 5: Tell it what to protect

Out of the box it's set up for **GTA 6**. To protect something else:

1. Click the SpoilerAlert icon → **Edit keywords and settings**.
2. Click **Clear all lists**.
3. Fill in the lists, **one item per line**:
   - **Topic terms:** the title you're avoiding and its spellings, e.g. `Severance`, `#SeveranceS3`
   - **Spoiler terms:** character names and spoiler words, e.g. `Mark`, `Helly`, `finale`, `dies`, `ending`, `twist`
   - **Always-block phrases** (optional): things to hide even when the title isn't mentioned, e.g. a leaker's username
   - **Never counts as the topic** (optional): look-alikes that should not trigger it, e.g. `severance pay`
4. Type a headline into the **Try it** box to check what would be hidden.
5. Click **Save**.

Something is hidden when it mentions **a topic term and a spoiler term** (or an always-block phrase). So "Severance season 3 release date" stays visible, but "Severance finale: who dies?" gets blurred. Want *zero* mentions of the title? Tick **Strict mode**.

## Step 6 (optional): Turn it on for news sites and everything else

By default SpoilerAlert only runs on **YouTube, Reddit, Instagram and Facebook**. To cover news sites, blogs and the rest of the web:

1. Open **Edit keywords and settings**.
2. Scroll to **Where it runs** and click **Allow on all websites**.
3. Chrome warns that the extension can "read and change all your data on all websites". It needs that access to look for spoilers on any page. **Nothing is ever sent anywhere**; it all happens on your computer.
4. Reload any tabs that were already open.

## Step 7: Try it

Search YouTube or Reddit for your title plus a word like "ending" or "leak". Matching results should be blurred with **"Possible spoiler — click to reveal"**. Click one to reveal just that item.

---

## Troubleshooting

- **"Manifest file is missing or unreadable"**: you selected the wrong folder. Pick the one that directly contains `manifest.json` (often one level deeper).
- **Nothing gets blurred:** reload the page after installing. Make sure the switch in the SpoilerAlert popup is on, and use **Try it** in settings to check your lists.
- **Too much gets blurred:** remove very common words from **Spoiler terms**, or move a phrase out of **Always-block**. Make sure **Strict mode** is off.
- **Chrome shows a "developer mode extensions" warning on startup:** that's normal for extensions installed this way. Close it, or click **Keep**.
- **It stopped working after I cleaned up my Downloads:** you deleted the folder Chrome runs it from. Download it again (step 1) and redo step 3.

## Updating to a new version

Download the new ZIP and unzip it into the **same place**, replacing the old files. Then open `chrome://extensions` and click the **circular reload arrow** on SpoilerAlert's card. Your keyword lists are kept.

## Uninstalling

Open `chrome://extensions`, click **Remove** on SpoilerAlert, then delete the folder.

## Privacy

SpoilerAlert runs entirely in your browser. It makes **no network requests**, has **no analytics or tracking**, and your keyword lists are stored only in your own Chrome profile. The full source code is in the repo, so anyone can check.

## Known limits

- It can't read text inside images, so a thumbnail with the spoiler written on the picture is only hidden if the video or post title also matches.
- It doesn't blur the video player itself, or catch spoilers spoken in a video.
- Websites change their layout often, so if it suddenly misses things on one site, that site probably changed. Please report it.
