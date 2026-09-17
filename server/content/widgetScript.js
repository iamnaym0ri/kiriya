// The Scriptable widget, handed to Settings with the site's address filled in. Settings adds the
// device key on the phone itself, so the key never passes back through the server.

export function scriptableWidget(siteUrl) {
  return `// kiriya ♡ — a little widget for Scriptable.
// Works on the Home Screen (small, medium, large) and the Lock Screen.
const KEY = "__KIRIYA_WIDGET_KEY__";
const SITE = ${JSON.stringify(siteUrl.replace(/\/$/, ""))};

const plum = new Color("#493653");
const soft = new Color("#8b6c92");
const pink = new Color("#b77ea6");
const family = config.widgetFamily || "medium";

async function load() {
  const request = new Request(SITE + "/api/widget");
  request.headers = { Authorization: "Bearer " + KEY };
  request.timeoutInterval = 15;
  try {
    const data = await request.loadJSON();
    return request.response.statusCode === 200 ? data : { error: data.message || "couldn’t open your world" };
  } catch (error) {
    return { error: "couldn’t reach your world right now" };
  }
}

function text(stack, value, size, color, bold) {
  const line = stack.addText(value);
  line.font = bold ? Font.boldRoundedSystemFont(size) : Font.regularRoundedSystemFont(size);
  line.textColor = color;
  line.lineLimit = 2;
  return line;
}

const battery = (level) => "▮".repeat(level + 1) + "▯".repeat(4 - level);

const data = await load();
const widget = new ListWidget();

if (family.startsWith("accessory")) {
  // Lock Screen: the system tints these, so keep them to plain words.
  const status = data.status;
  if (data.error) widget.addText("kiriya ♡");
  else if (family === "accessoryInline") widget.addText(data.unread ? "💌 " + data.unread + " new" : "🔋 " + (status ? status.battery.label : "kiriya ♡"));
  else if (family === "accessoryCircular") {
    widget.addText(data.unread ? "💌" : status && status.mood ? status.mood.emoji : "♡").centerAlignText();
    widget.addText(data.unread ? String(data.unread) : status ? battery(status.battery.level) : "").centerAlignText();
  } else {
    text(widget, status ? (status.mood ? status.mood.emoji + " " + status.mood.label : status.presentation.label) + " · " + status.pronouns : "kiriya ♡", 13, Color.white(), true);
    if (status) text(widget, "🔋 " + status.battery.label, 12, Color.white());
    text(widget, data.latestNote ? "💌 " + data.latestNote.title : "no notes yet", 12, Color.white());
  }
} else {
  const gradient = new LinearGradient();
  gradient.colors = [new Color("#fbf5fd"), new Color("#ead9f2")];
  gradient.locations = [0, 1];
  widget.backgroundGradient = gradient;
  widget.setPadding(14, 14, 12, 14);

  const head = widget.addStack();
  text(head, "kiriya", 17, plum, true);
  head.addSpacer(4);
  text(head, "✦", 13, pink);
  head.addSpacer();
  if (data.unread) text(head, "💌 " + data.unread, 13, pink, true);
  widget.addSpacer(6);

  if (data.error) {
    text(widget, data.error, 12, soft);
  } else {
    const status = data.status;
    if (status) {
      text(widget, (status.mood ? status.mood.emoji + " " + status.mood.label : status.presentation.face + " " + status.presentation.label) + " · " + status.pronouns, family === "small" ? 12 : 14, plum, true);
      text(widget, battery(status.battery.level) + " " + status.battery.label, 11, soft);
    } else {
      text(widget, "tap to tell your world how you are ♡", 12, soft);
    }
    if (family !== "small" && data.latestNote) {
      widget.addSpacer(8);
      text(widget, "💌 " + data.latestNote.title, 13, plum, true);
      const preview = text(widget, data.latestNote.preview, 11, soft);
      preview.lineLimit = family === "large" ? 8 : 2;
    }
  }
  widget.addSpacer();
}

// A tap opens the newest note when one is waiting, otherwise the check-in.
widget.url = data.links ? (data.unread ? data.links.notes : data.links.status) : SITE + "/world";
widget.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);

if (config.runsInWidget) Script.setWidget(widget);
else await widget.presentMedium();
Script.complete();
`;
}
