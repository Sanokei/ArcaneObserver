import { Hono, type Context } from "hono";
import archiveTemplate from "./views/archive.html";
import homeTemplate from "./views/index.html";

type StoryKey =
  | "firststory"
  | "secondstory"
  | "thirdstory"
  | "firstsubstory"
  | "secondsubstory"
  | "thirdsubstory"
  | "fourthsubstory"
  | "fifthsubstory"
  | "sixthsubstory"
  | "seventhsubstory"
  | "eighthsubstory";

type Story = {
  title: string;
  article: string;
  link: string;
  image: string;
  caption?: string;
};

type NewspaperIssue = {
  date: string;
} & Partial<Record<StoryKey, Story>>;

type ArchivedIssue = {
  issueNumber: number;
  publicationDate: string;
  createdAt: string;
  issue: NewspaperIssue;
};

type IssueRow = {
  issue_number: number;
  publication_date: string;
  payload: string;
};

type SourceArticle = {
  url: string;
  title: string;
  text: string;
  topImage: string;
  publishedAt?: string;
  modifiedAt?: string;
};

type AiTextResult = {
  response?: unknown;
  text?: string;
  choices?: Array<{
    message?: {
      content?: string;
    };
    text?: string;
  }>;
};

type GeneratedStory = Pick<Story, "title" | "article" | "caption">;

type GeneratedStories = Partial<Record<StoryKey, GeneratedStory>>;

type ArticleSummaries = Record<StoryKey, string>;

type StoryLengthRule = {
  role: string;
  minWords: number;
  maxWords: number;
};

type WaybackCapture = {
  timestamp: string;
  original: string;
};

type HonoBindings = {
  Bindings: Env;
};

type AppContext = Context<HonoBindings>;

const app = new Hono<HonoBindings>();

const DEFAULT_NEWS_SOURCE_URL = "https://apnews.com/oddities";
const DEFAULT_AI_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const SITE_JSON_FILENAME = "site.json";
const ARTICLE_SUMMARY_CHAR_LIMIT = 1200;
const MAX_GENERATION_ATTEMPTS = 5;
const BACKFILL_API_VERSION = 1;
const STORY_KEYS: StoryKey[] = [
  "firststory",
  "secondstory",
  "thirdstory",
  "firstsubstory",
  "secondsubstory",
  "thirdsubstory",
  "fourthsubstory",
  "fifthsubstory",
  "sixthsubstory",
  "seventhsubstory",
  "eighthsubstory",
];
const STORY_BATCHES: StoryKey[][] = [
  ["firststory", "secondstory", "thirdstory"],
  ["firstsubstory", "secondsubstory", "thirdsubstory", "fourthsubstory"],
  ["fifthsubstory", "sixthsubstory", "seventhsubstory", "eighthsubstory"],
];
const STORY_LENGTH_RULES: Record<StoryKey, StoryLengthRule> = {
  firststory: { role: "lead feature", minWords: 125, maxWords: 205 },
  secondstory: { role: "secondary feature", minWords: 95, maxWords: 170 },
  thirdstory: { role: "secondary feature", minWords: 95, maxWords: 170 },
  firstsubstory: { role: "brief", minWords: 65, maxWords: 135 },
  secondsubstory: { role: "brief", minWords: 65, maxWords: 135 },
  thirdsubstory: { role: "brief", minWords: 65, maxWords: 135 },
  fourthsubstory: { role: "brief", minWords: 65, maxWords: 135 },
  fifthsubstory: { role: "brief", minWords: 65, maxWords: 135 },
  sixthsubstory: { role: "brief", minWords: 65, maxWords: 135 },
  seventhsubstory: { role: "brief", minWords: 65, maxWords: 135 },
  eighthsubstory: { role: "brief", minWords: 65, maxWords: 135 },
};
const BANNED_ARTICLE_PHRASES = [
  {
    label: '"it is believed"',
    pattern: /\bit is believed\b/i,
    replacement: "officials say",
  },
  {
    label: '"known for"',
    pattern: /\bknown for\b/i,
    replacement: "identified by",
  },
  {
    label: `"what they didn't know"`,
    pattern: /\bwhat they didn't know\b/i,
    replacement: "investigators later learned",
  },
  {
    label: '"the real reason behind"',
    pattern: /\bthe real reason behind\b/i,
    replacement: "the cause of",
  },
  {
    label: '"behind the scenes"',
    pattern: /\bbehind the scenes\b/i,
    replacement: "in the sealed report",
  },
  {
    label: `"the wizard's magic continued"`,
    pattern: /\bthe wizard'?s magic continued\b/i,
    replacement: "the spell left paperwork",
  },
  {
    label: '"unknowingly fueled by"',
    pattern: /\bunknowingly fueled by\b/i,
    replacement: "fueled by",
  },
  {
    label: '"magical forces at play"',
    pattern: /\bmagical forces at play\b/i,
    replacement: "spellwork in effect",
  },
  {
    label: '"the real culprit was a wizard"',
    pattern: /\bthe real culprit was a wizard\b/i,
    replacement: "Ministry records named the responsible caster",
  },
  {
    label: '"may be linked"',
    pattern: /\bmay be linked\b/i,
    replacement: "was tied",
  },
  {
    label: '"sources suggest"',
    pattern: /\bsources suggest\b/i,
    replacement: "records indicate",
  },
  {
    label: '"whispers within"',
    pattern: /\bwhispers within\b/i,
    replacement: "memoranda from",
  },
  {
    label: '"speculate that"',
    pattern: /\bspeculate that\b/i,
    replacement: "say",
  },
  {
    label: '"restoring balance"',
    pattern: /\brestor(?:e|ed|ing) balance to (?:the )?(?:world|universe|ecosystem)\b/i,
    replacement: "closing the incident file",
  },
];
const BANNED_TITLE_PATTERNS = [
  {
    label: 'titles beginning with "Wizardly"',
    pattern: /^wizardly\b/i,
  },
  {
    label: `"Thanks to Wizard's..." titles`,
    pattern: /\bthanks to wizard'?s\b/i,
  },
  {
    label: `"Due to Wizard's..." titles`,
    pattern: /\bdue to wizard'?s\b/i,
  },
  {
    label: `"Courtesy of Wizard's..." titles`,
    pattern: /\bcourtesy of wizard'?s\b/i,
  },
  {
    label: '"mischievous mage" titles',
    pattern: /\bmischievous mage\b/i,
  },
];
const MAGICAL_TITLE_PATTERN =
  /\b(wizard\w*|witch\w*|mage|ministry|spell\w*|curse\w*|hex\w*|clone\w*|duplicate\w*|transfigur\w*|portal\w*|ritual\w*|golem\w*|artifact\w*|apparition\w*|ghost\w*|dragon\w*|potion\w*|charm\w*|enchant\w*|summon\w*|familiar\w*|ward\w*|hoard\w*|beacon\w*|arcane|etherial|ethereal|lunar|celestial|magic|magical|sorcer\w*|alchemy|wand\w*|conjur\w*)\b/i;
const MAGICAL_TITLE_ROOT_LIST =
  "wizard, witch, mage, ministry, spell, curse, hex, clone, duplicate, transfigure, portal, ritual, golem, artifact, apparition, ghost, dragon, potion, charm, enchant, summon, familiar, ward, hoard, beacon, arcane, ethereal, lunar, celestial, magic, sorcerer, alchemy, wand, conjure";
const GENERIC_CAPTIONS = new Set([
  "magic",
  "bridge crash",
  "wizard",
  "wizardry",
  "mystery",
]);

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
};

app.get("/", async (c) => {
  const issue = await getCurrentIssue(c.env, c.req.raw);
  const issueNumber = await getCurrentIssueNumber(c.env);

  return c.html(renderHome(issue, issueNumber));
});

app.get("/api/current", async (c) => {
  const issue = await getCurrentIssue(c.env, c.req.raw);
  return c.json(issue);
});

app.get("/api/backfill-status", (c) =>
  c.json({
    backfillApiVersion: BACKFILL_API_VERSION,
    maxGenerationAttempts: MAX_GENERATION_ATTEMPTS,
    headlineRepair: true,
  }),
);

app.get("/archive", async (c) => {
  const issues = await getArchivedIssues(c.env);
  return c.html(renderArchive(issues));
});

app.get("/archive/:issueNumber", async (c) => {
  const issueNumber = Number.parseInt(c.req.param("issueNumber"), 10);
  if (!Number.isSafeInteger(issueNumber) || issueNumber <= 0) {
    return c.text("Archive issue not found.", 404);
  }

  const archivedIssue = await getArchivedIssue(c.env, issueNumber);
  if (!archivedIssue) {
    return c.text("Archive issue not found.", 404);
  }

  return c.html(renderHome(archivedIssue.issue, archivedIssue.issueNumber));
});

app.get("/proxy-image", async (c) => proxyImage(c.req.raw));

app.get("/updatepaper", async (c) => refreshPaper(c));
app.post("/updatepaper", async (c) => refreshPaper(c));
app.post("/api/updatepaper", async (c) => refreshPaper(c));
app.post("/api/backfill-issue", async (c) => backfillIssue(c));
app.post("/api/preview-historical-issue", async (c) => previewHistoricalIssue(c));
app.post("/api/preview-historical-batch", async (c) => previewHistoricalBatch(c));
app.post("/api/preview-current-batch", async (c) => previewCurrentBatch(c));

app.all("*", async (c) => c.env.ASSETS.fetch(c.req.raw));

async function refreshPaper(c: AppContext) {
  const configuredSecret = getUpdateSecret(c.env);
  if (!configuredSecret) {
    return c.json({ error: "UPDATE_SECRET or NEW_STORY_KEY is not configured." }, 500);
  }

  const apiKey = c.req.header("x-api-key");
  if (!apiKey || !(await timingSafeEqual(apiKey, configuredSecret))) {
    return c.json({ error: "Invalid or missing API key." }, 401);
  }

  const result = await refreshIssue(c.env);

  return c.json({
    message: "Paper updated successfully.",
    issueNumber: result.issueNumber,
    date: result.date,
  });
}

async function backfillIssue(c: AppContext) {
  const configuredSecret = getUpdateSecret(c.env);
  if (!configuredSecret) {
    return c.json({ error: "UPDATE_SECRET or NEW_STORY_KEY is not configured." }, 500);
  }

  const apiKey = c.req.header("x-api-key");
  if (!apiKey || !(await timingSafeEqual(apiKey, configuredSecret))) {
    return c.json({ error: "Invalid or missing API key." }, 401);
  }

  const issueDate = parseIssueDate(c.req.query("date"));
  if (!issueDate || issueDate.getUTCDay() !== 1) {
    return c.json({ error: "date must be a Monday in YYYY-MM-DD format." }, 400);
  }
  const sourceSnapshot = parseWaybackSnapshot(c.req.query("snapshot"));
  if (c.req.query("snapshot") && !sourceSnapshot) {
    return c.json({ error: "snapshot must be a 14-digit Wayback timestamp." }, 400);
  }
  const sourceHtml = await readSourceHtmlBody(c);

  try {
    const result = await buildHistoricalIssue(c.env, issueDate, sourceSnapshot, sourceHtml);
    const issueNumber = issueNumberForDate(issueDate);
    await saveArchivedIssue(c.env, result.issue, issueNumber);

    return c.json({
      message: "Historical issue archived successfully.",
      issueNumber,
      date: result.issue.date,
      sourceSnapshot: result.sourceSnapshot,
    });
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}

async function previewHistoricalIssue(c: AppContext) {
  const configuredSecret = getUpdateSecret(c.env);
  if (!configuredSecret) {
    return c.json({ error: "UPDATE_SECRET or NEW_STORY_KEY is not configured." }, 500);
  }

  const apiKey = c.req.header("x-api-key");
  if (!apiKey || !(await timingSafeEqual(apiKey, configuredSecret))) {
    return c.json({ error: "Invalid or missing API key." }, 401);
  }

  const issueDate = parseIssueDate(c.req.query("date"));
  if (!issueDate || issueDate.getUTCDay() !== 1) {
    return c.json({ error: "date must be a Monday in YYYY-MM-DD format." }, 400);
  }
  const sourceSnapshot = parseWaybackSnapshot(c.req.query("snapshot"));
  if (c.req.query("snapshot") && !sourceSnapshot) {
    return c.json({ error: "snapshot must be a 14-digit Wayback timestamp." }, 400);
  }
  const sourceHtml = await readSourceHtmlBody(c);

  try {
    const result = await buildHistoricalIssue(c.env, issueDate, sourceSnapshot, sourceHtml);
    return c.json({
      date: result.issue.date,
      sourceSnapshot: result.sourceSnapshot,
      issue: result.issue,
    });
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}

async function previewHistoricalBatch(c: AppContext) {
  const configuredSecret = getUpdateSecret(c.env);
  if (!configuredSecret) {
    return c.json({ error: "UPDATE_SECRET or NEW_STORY_KEY is not configured." }, 500);
  }

  const apiKey = c.req.header("x-api-key");
  if (!apiKey || !(await timingSafeEqual(apiKey, configuredSecret))) {
    return c.json({ error: "Invalid or missing API key." }, 401);
  }

  const issueDate = parseIssueDate(c.req.query("date"));
  if (!issueDate || issueDate.getUTCDay() !== 1) {
    return c.json({ error: "date must be a Monday in YYYY-MM-DD format." }, 400);
  }

  const batchNumber = Number.parseInt(c.req.query("batch") || "", 10);
  const storyKeys = STORY_BATCHES[batchNumber];
  if (!storyKeys) {
    return c.json({ error: `batch must be between 0 and ${STORY_BATCHES.length - 1}.` }, 400);
  }

  try {
    const sourceSnapshot = parseWaybackSnapshot(c.req.query("snapshot"));
    if (c.req.query("snapshot") && !sourceSnapshot) {
      return c.json({ error: "snapshot must be a 14-digit Wayback timestamp." }, 400);
    }
    const sourceHtml = await readSourceHtmlBody(c);
    const historicalSource = await loadHistoricalSourceArticles(
      c.env,
      issueDate,
      sourceSnapshot,
      sourceHtml,
    );
    const articleSummaries = prepareArticleSummaries(historicalSource.articles);
    const preview = await previewWizardStoryBatch(c.env, articleSummaries, storyKeys, {});

    return c.json({
      date: formatDate(issueDate),
      sourceSnapshot: historicalSource.sourceSnapshot,
      sourceArticles: storyKeys.map((key) => ({
        key,
        title: historicalSource.articles[STORY_KEYS.indexOf(key)]?.title || "",
      })),
      stories: preview.stories,
      validationIssues: preview.validationIssues,
    });
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}

async function previewCurrentBatch(c: AppContext) {
  const configuredSecret = getUpdateSecret(c.env);
  if (!configuredSecret) {
    return c.json({ error: "UPDATE_SECRET or NEW_STORY_KEY is not configured." }, 500);
  }

  const apiKey = c.req.header("x-api-key");
  if (!apiKey || !(await timingSafeEqual(apiKey, configuredSecret))) {
    return c.json({ error: "Invalid or missing API key." }, 401);
  }

  const batchNumber = Number.parseInt(c.req.query("batch") || "", 10);
  const storyKeys = STORY_BATCHES[batchNumber];
  if (!storyKeys) {
    return c.json({ error: `batch must be between 0 and ${STORY_BATCHES.length - 1}.` }, 400);
  }

  try {
    const articles = await fetchNewsArticles(c.env);
    const articleSummaries = prepareArticleSummaries(articles);
    const preview = await previewWizardStoryBatch(c.env, articleSummaries, storyKeys, {});

    return c.json({
      date: formatDate(new Date()),
      sourceArticles: storyKeys.map((key) => ({
        key,
        title: articles[STORY_KEYS.indexOf(key)]?.title || "",
      })),
      stories: preview.stories,
      validationIssues: preview.validationIssues,
    });
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}


async function refreshIssue(env: Env): Promise<{ issueNumber: number; date: string }> {
  const issue = await buildFreshIssue(env);
  const issueNumber = Math.floor(Date.now() / 1000);
  await saveIssue(env, issue, issueNumber);
  return { issueNumber, date: issue.date };
}

async function runScheduledRefresh(env: Env): Promise<void> {
  try {
    const result = await refreshIssue(env);
    console.log(
      JSON.stringify({
        event: "scheduled_refresh_complete",
        issueNumber: result.issueNumber,
        date: result.date,
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "scheduled_refresh_failed",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    throw error;
  }
}

function getUpdateSecret(env: Env): string | undefined {
  const secrets = env as Env & {
    UPDATE_SECRET?: string;
    NEW_STORY_KEY?: string;
  };
  return secrets.UPDATE_SECRET || secrets.NEW_STORY_KEY;
}

function getAiModel(env: Env): string {
  return (env as Env & { AI_MODEL?: string }).AI_MODEL || DEFAULT_AI_MODEL;
}

async function readSourceHtmlBody(c: AppContext): Promise<string | undefined> {
  if (!c.req.header("content-type")?.toLowerCase().includes("application/json")) {
    return undefined;
  }

  try {
    const body = (await c.req.json()) as { sourceHtml?: unknown };
    return typeof body.sourceHtml === "string" && body.sourceHtml.trim()
      ? body.sourceHtml
      : undefined;
  } catch {
    return undefined;
  }
}

async function getCurrentIssue(env: Env, request: Request): Promise<NewspaperIssue> {
  const row = await env.DB.prepare(
    "SELECT payload FROM issues WHERE slug = ? LIMIT 1",
  )
    .bind("current")
    .first<{ payload: string }>();

  if (row?.payload) {
    return JSON.parse(row.payload) as NewspaperIssue;
  }

  return loadFallbackIssue(env, request);
}

async function getCurrentIssueNumber(env: Env): Promise<number> {
  const row = await env.DB.prepare(
    "SELECT issue_number FROM issues WHERE slug = ? LIMIT 1",
  )
    .bind("current")
    .first<{ issue_number: number }>();

  return row?.issue_number ?? Math.floor(Date.now() / 1000);
}

async function loadFallbackIssue(env: Env, request: Request): Promise<NewspaperIssue> {
  const fallbackUrl = new URL(`/${SITE_JSON_FILENAME}`, request.url);
  const response = await env.ASSETS.fetch(new Request(fallbackUrl));

  if (!response.ok) {
    return { date: formatDate(new Date()) };
  }

  return (await response.json()) as NewspaperIssue;
}

async function saveIssue(
  env: Env,
  issue: NewspaperIssue,
  issueNumber: number,
): Promise<void> {
  const payload = JSON.stringify(issue);
  const currentIssue = await env.DB.prepare(
    `SELECT issue_number, publication_date, payload
     FROM issues
     WHERE slug = ?
     LIMIT 1`,
  )
    .bind("current")
    .first<IssueRow>();

  const statements = [
    env.DB.prepare(
      `INSERT INTO issues
        (slug, issue_number, publication_date, payload, created_at, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(slug) DO UPDATE SET
        issue_number = excluded.issue_number,
        publication_date = excluded.publication_date,
        payload = excluded.payload,
        updated_at = CURRENT_TIMESTAMP`,
    ).bind("current", issueNumber, issue.date, payload),
  ];

  if (currentIssue) {
    statements.unshift(
      env.DB.prepare(
      `INSERT INTO issue_history
        (issue_number, publication_date, payload)
       VALUES (?, ?, ?)`,
      ).bind(
        currentIssue.issue_number,
        currentIssue.publication_date,
        currentIssue.payload,
      ),
    );
  }

  await env.DB.batch(statements);
}

async function saveArchivedIssue(
  env: Env,
  issue: NewspaperIssue,
  issueNumber: number,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO issue_history
      (issue_number, publication_date, payload)
     SELECT ?, ?, ?
     WHERE NOT EXISTS (
       SELECT 1
       FROM issue_history
       WHERE issue_number = ?
     )`,
  )
    .bind(issueNumber, issue.date, JSON.stringify(issue), issueNumber)
    .run();
}

async function getArchivedIssues(env: Env): Promise<ArchivedIssue[]> {
  const rows = await env.DB.prepare(
    `SELECT issue_number, publication_date, payload, created_at
     FROM issue_history
     ORDER BY created_at DESC, id DESC`,
  ).all<IssueRow & { created_at: string }>();

  return rows.results
    .map((row) => parseArchivedIssue(row))
    .filter((issue): issue is ArchivedIssue => Boolean(issue));
}

async function getArchivedIssue(
  env: Env,
  issueNumber: number,
): Promise<ArchivedIssue | undefined> {
  const row = await env.DB.prepare(
    `SELECT issue_number, publication_date, payload, created_at
     FROM issue_history
     WHERE issue_number = ?
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
  )
    .bind(issueNumber)
    .first<IssueRow & { created_at: string }>();

  return row ? parseArchivedIssue(row) : undefined;
}

function parseArchivedIssue(
  row: IssueRow & { created_at: string },
): ArchivedIssue | undefined {
  try {
    return {
      issueNumber: row.issue_number,
      publicationDate: row.publication_date,
      createdAt: row.created_at,
      issue: JSON.parse(row.payload) as NewspaperIssue,
    };
  } catch {
    return undefined;
  }
}

async function buildFreshIssue(env: Env): Promise<NewspaperIssue> {
  const articles = await fetchNewsArticles(env);
  if (articles.length === 0) {
    throw new Error("No articles were found from the configured news source.");
  }

  const summaries = prepareArticleSummaries(articles);
  const wizardStories = await generateWizardStories(env, summaries);
  return createNewspaperIssue(articles, wizardStories);
}

async function buildHistoricalIssue(
  env: Env,
  issueDate: Date,
  sourceSnapshot?: string,
  sourceHtml?: string,
): Promise<{ issue: NewspaperIssue; sourceSnapshot: string }> {
  const historicalSource = await loadHistoricalSourceArticles(
    env,
    issueDate,
    sourceSnapshot,
    sourceHtml,
  );
  const summaries = prepareArticleSummaries(historicalSource.articles);
  const wizardStories = await generateWizardStories(env, summaries);
  return {
    issue: createNewspaperIssue(historicalSource.articles, wizardStories, issueDate),
    sourceSnapshot: historicalSource.sourceSnapshot,
  };
}

async function loadHistoricalSourceArticles(
  env: Env,
  issueDate: Date,
  sourceSnapshot?: string,
  sourceHtml?: string,
): Promise<{ articles: SourceArticle[]; sourceSnapshot: string }> {
  const sourceUrl = env.NEWS_SOURCE_URL || DEFAULT_NEWS_SOURCE_URL;
  const cutoff = formatWaybackTimestamp(new Date(issueDate.getTime() - 1));
  const sourceCapture = sourceSnapshot
    ? { timestamp: sourceSnapshot, original: sourceUrl }
    : await findLatestWaybackCapture(sourceUrl, cutoff);
  if (!sourceCapture) {
    throw new Error(`No historical source snapshot exists before ${formatIsoDate(issueDate)}.`);
  }

  const html = sourceHtml || (await fetchWaybackHtml(sourceCapture));
  const articles = await fetchHistoricalNewsArticles(html, sourceUrl, issueDate);
  return {
    articles,
    sourceSnapshot: sourceCapture.timestamp,
  };
}

async function fetchWaybackHtml(sourceCapture: WaybackCapture): Promise<string> {
  const response = await fetch(buildWaybackUrl(sourceCapture), { headers: FETCH_HEADERS });
  if (!response.ok) {
    throw new Error(`Historical source snapshot returned ${response.status}.`);
  }

  return response.text();
}

async function fetchNewsArticles(env: Env): Promise<SourceArticle[]> {
  const sourceUrl = env.NEWS_SOURCE_URL || DEFAULT_NEWS_SOURCE_URL;
  const response = await fetch(sourceUrl, { headers: FETCH_HEADERS });
  if (!response.ok) {
    throw new Error(`News source returned ${response.status}`);
  }

  const html = await response.text();
  const links = extractHeadlineLinks(html, sourceUrl);
  const articles: SourceArticle[] = [];
  const seenArticleUrls = new Set<string>();

  for (let index = 0; index < links.length; index += STORY_KEYS.length) {
    const batch = links.slice(index, index + STORY_KEYS.length);
    const fetchedArticles = await Promise.all(
      batch.map(async (link) => fetchArticle(link.url, link.title)),
    );

    for (const article of fetchedArticles) {
      if (!article) {
        continue;
      }

      const articleUrl = normalizeArticleUrl(article.url);
      if (seenArticleUrls.has(articleUrl)) {
        continue;
      }

      seenArticleUrls.add(articleUrl);
      articles.push(article);

      if (articles.length === STORY_KEYS.length) {
        return articles;
      }
    }
  }

  throw new Error(
    `Only found ${articles.length} unique usable articles; ${STORY_KEYS.length} are required.`,
  );
}

async function fetchHistoricalNewsArticles(
  html: string,
  sourceUrl: string,
  issueDate: Date,
): Promise<SourceArticle[]> {
  const links = extractHeadlineLinks(html, sourceUrl);
  const articles: SourceArticle[] = [];
  const seenArticleUrls = new Set<string>();

  for (const link of links) {
    const article = await fetchArticle(link.url, link.title, issueDate);
    if (!article) {
      continue;
    }

    const articleUrl = normalizeArticleUrl(article.url);
    if (seenArticleUrls.has(articleUrl)) {
      continue;
    }

    seenArticleUrls.add(articleUrl);
    articles.push(article);

    if (articles.length === STORY_KEYS.length) {
      return articles;
    }
  }

  throw new Error(
    `Only found ${articles.length} historically eligible articles; ${STORY_KEYS.length} are required.`,
  );
}

function extractHeadlineLinks(
  html: string,
  sourceUrl: string,
): Array<{ url: string; title: string }> {
  const sectionHtml = extractOdditiesSectionHtml(html);
  const promoLinks = extractPagePromoHeadlineLinks(sectionHtml, sourceUrl);
  if (promoLinks.length >= STORY_KEYS.length) {
    return promoLinks;
  }

  return extractGenericHeadlineLinks(sectionHtml, sourceUrl);
}

function extractOdditiesSectionHtml(html: string): string {
  const odditiesHeading = html.search(
    /<h1\b[^>]*class=["'][^"']*\bPageList-header-title\b[^"']*["'][^>]*>\s*Oddities\s*<\/h1>/i,
  );

  return odditiesHeading >= 0 ? html.slice(odditiesHeading) : html;
}

function extractPagePromoHeadlineLinks(
  html: string,
  sourceUrl: string,
): Array<{ url: string; title: string }> {
  const promoStarts = Array.from(
    html.matchAll(/<div\b[^>]*class=["'][^"']*\bPagePromo\b[^"']*["'][^>]*>/gi),
  );
  const seenUrls = new Set<string>();
  const links: Array<{ url: string; title: string }> = [];

  for (let index = 0; index < promoStarts.length; index += 1) {
    const promoStart = promoStarts[index];
    if (promoStart.index === undefined) {
      continue;
    }

    const nextPromoStart = promoStarts[index + 1]?.index ?? html.length;
    const promoHtml = html.slice(promoStart.index, nextPromoStart);
    const href = promoHtml.match(/\bhref=["']([^"']*\/article\/[^"']+)["']/i)?.[1];
    if (!href) {
      continue;
    }

    const url = normalizeArticleUrl(new URL(decodeHtml(href), sourceUrl).toString());
    const title =
      normalizeWhitespace(decodeHtml(extractAttribute(promoStart[0], "data-gtm-region"))) ||
      normalizeWhitespace(
        stripTags(
          decodeHtml(
            promoHtml.match(
              /<h[1-6]\b[^>]*class=["'][^"']*\bPagePromo-title\b[^"']*["'][^>]*>([\s\S]*?)<\/h[1-6]>/i,
            )?.[1] ?? "",
          ),
        ),
      );

    if (seenUrls.has(url) || title.length < 20 || title === "No Value") {
      continue;
    }

    seenUrls.add(url);
    links.push({ url, title });
  }

  return links;
}

function extractGenericHeadlineLinks(
  html: string,
  sourceUrl: string,
): Array<{ url: string; title: string }> {
  const matches = html.matchAll(
    /<a\b(?=[^>]*\bclass=["'][^"']*\bLink\b[^"']*["'])(?=[^>]*\bhref=["']([^"']*\/article\/[^"']+)["'])[^>]*>([\s\S]*?)<\/a>/gi,
  );
  const seenUrls = new Set<string>();
  const links: Array<{ url: string; title: string }> = [];

  for (const match of matches) {
    const url = normalizeArticleUrl(new URL(decodeHtml(match[1]), sourceUrl).toString());
    const title = normalizeWhitespace(stripTags(decodeHtml(match[2])));

    if (seenUrls.has(url) || title.length < 20) {
      continue;
    }

    seenUrls.add(url);
    links.push({ url, title });
  }

  return links;
}

async function fetchArticle(
  url: string,
  fallbackTitle: string,
  publishedBefore?: Date,
): Promise<SourceArticle | null> {
  try {
    const response = await fetch(url, { headers: FETCH_HEADERS });
    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const publishedAt = extractArticleTimestamp(html, "article:published_time", "datePublished");
    const modifiedAt = extractArticleTimestamp(html, "article:modified_time", "dateModified");

    if (
      publishedBefore &&
      (!publishedAt || new Date(publishedAt).getTime() >= publishedBefore.getTime())
    ) {
      return null;
    }

    const paragraphs = extractArticleParagraphs(html);

    const text = paragraphs.slice(0, 5).join("\n");
    if (!text) {
      return null;
    }

    return {
      url,
      title: extractMetaContent(html, "og:title") || fallbackTitle,
      text,
      topImage:
        extractMetaContent(html, "og:image") ||
        extractMetaContent(html, "twitter:image") ||
        "",
      publishedAt,
      modifiedAt,
    };
  } catch {
    return null;
  }
}

function extractArticleParagraphs(html: string): string[] {
  const bodyHtml = extractArticleBodyHtml(html);

  return Array.from(bodyHtml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
    .map((match) => normalizeWhitespace(stripTags(decodeHtml(match[1]))))
    .filter(isUsableArticleParagraph);
}

function extractArticleBodyHtml(html: string): string {
  const bodyMatch = html.match(
    /<div\b[^>]*class=["'][^"']*\bRichTextStoryBody\b[^"']*["'][^>]*>/i,
  );

  if (!bodyMatch || bodyMatch.index === undefined) {
    return html;
  }

  const start = bodyMatch.index + bodyMatch[0].length;
  const endMarkers = [
    '<div class="Page-tags',
    '<div class="RelatedContent',
    '<div class="SovrnAd',
    '<footer',
    "</article>",
  ];
  const end = endMarkers
    .map((marker) => html.indexOf(marker, start))
    .filter((index) => index > start)
    .sort((left, right) => left - right)[0];

  return html.slice(start, end ?? undefined);
}

function isUsableArticleParagraph(text: string): boolean {
  if (text.length < 40) {
    return false;
  }

  return !/^Copyright \d{4} The Associated Press/i.test(text);
}

function prepareArticleSummaries(articles: SourceArticle[]): ArticleSummaries {
  const summaries = {} as ArticleSummaries;

  articles.slice(0, STORY_KEYS.length).forEach((article, index) => {
    const key = STORY_KEYS[index];
    const summaryText = article.text.includes(" - ")
      ? article.text.split(" - ", 2)[1]
      : article.text;
    summaries[key] = `${key}: ${article.title}\n${summaryText.slice(
      0,
      ARTICLE_SUMMARY_CHAR_LIMIT,
    )}`;
  });

  return summaries;
}

async function generateWizardStories(
  env: Env,
  articleSummaries: ArticleSummaries,
): Promise<Record<StoryKey, GeneratedStory>> {
  const stories: GeneratedStories = {};

  for (const batch of STORY_BATCHES) {
    const batchStories = await generateWizardStoryBatch(env, articleSummaries, batch, stories);
    Object.assign(stories, batchStories);
  }

  const validationIssues = validateGeneratedStories(stories, STORY_KEYS, true);
  if (validationIssues.length > 0) {
    throw new Error(`Workers AI failed final editorial review: ${validationIssues.join(" ")}`);
  }

  return stories as Record<StoryKey, GeneratedStory>;
}

async function generateWizardStoryBatch(
  env: Env,
  articleSummaries: ArticleSummaries,
  storyKeys: StoryKey[],
  priorStories: GeneratedStories,
): Promise<GeneratedStories> {
  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: buildGenerationSystemPrompt(storyKeys) },
    {
      role: "user",
      content: buildBatchUserPrompt(articleSummaries, storyKeys, priorStories),
    },
  ];
  let lastValidationIssues: string[] = [];

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const aiResult = (await env.AI.run(getAiModel(env), {
      messages,
      response_format: {
        type: "json_object",
      },
      max_tokens: storyKeys.includes("firststory") ? 1400 : 1300,
      temperature: 0.8,
      frequency_penalty: 0.35,
      presence_penalty: 0.25,
      repetition_penalty: 1.08,
    })) as AiTextResult;

    try {
      const stories = repairGeneratedStories(parseGeneratedStories(aiResult), storyKeys);
      const validationIssues = validateGeneratedStories(stories, storyKeys);
      if (validationIssues.length === 0) {
        return stories;
      }

      lastValidationIssues = validationIssues;
      console.warn(
        JSON.stringify({
          event: "ai_generation_validation_failed",
          attempt,
          issues: validationIssues,
          shape: summarizeGeneratedStoryShape(stories),
        }),
      );
      messages.push(
        { role: "assistant", content: JSON.stringify(stories) },
        { role: "user", content: buildRevisionPrompt(validationIssues) },
      );
    } catch (error) {
      const issue = error instanceof Error ? error.message : String(error);
      lastValidationIssues = [issue];
      console.warn(
        JSON.stringify({
          event: "ai_generation_parse_failed",
          attempt,
          issue,
        }),
      );
      messages.push({ role: "user", content: buildRevisionPrompt(lastValidationIssues) });
    }
  }

  throw new Error(
    `Workers AI failed editorial review after ${MAX_GENERATION_ATTEMPTS} attempts: ${lastValidationIssues.join(
      " ",
    )}`,
  );
}

async function previewWizardStoryBatch(
  env: Env,
  articleSummaries: ArticleSummaries,
  storyKeys: StoryKey[],
  priorStories: GeneratedStories,
): Promise<{ stories: GeneratedStories; validationIssues: string[] }> {
  const aiResult = (await env.AI.run(getAiModel(env), {
    messages: [
      { role: "system", content: buildGenerationSystemPrompt(storyKeys) },
      {
        role: "user",
        content: buildBatchUserPrompt(articleSummaries, storyKeys, priorStories),
      },
    ],
    response_format: {
      type: "json_object",
    },
    max_tokens: storyKeys.includes("firststory") ? 1400 : 1300,
    temperature: 0.8,
    frequency_penalty: 0.35,
    presence_penalty: 0.25,
    repetition_penalty: 1.08,
  })) as AiTextResult;

  const stories = repairGeneratedStories(parseGeneratedStories(aiResult), storyKeys);
  return {
    stories,
    validationIssues: validateGeneratedStories(stories, storyKeys),
  };
}

function createNewspaperIssue(
  articles: SourceArticle[],
  wizardStories: Record<StoryKey, GeneratedStory>,
  issueDate = new Date(),
): NewspaperIssue {
  if (articles.length !== STORY_KEYS.length) {
    throw new Error(
      `Expected ${STORY_KEYS.length} source articles, received ${articles.length}.`,
    );
  }

  const uniqueArticleUrls = new Set(articles.map((article) => normalizeArticleUrl(article.url)));
  if (uniqueArticleUrls.size !== STORY_KEYS.length) {
    throw new Error("Refusing to create an issue with duplicate source articles.");
  }

  const issue: NewspaperIssue = {
    date: formatDate(issueDate),
  };

  for (let index = 0; index < STORY_KEYS.length; index += 1) {
    const key = STORY_KEYS[index];
    const article = articles[index];
    const wizardStory = wizardStories[key];

    if (!wizardStory) {
      throw new Error(`Workers AI did not return a story for ${key}.`);
    }

    issue[key] = {
      title: wizardStory.title || article.title,
      article: wizardStory.article || article.text,
      link: article.url,
      image: article.topImage,
      caption: wizardStory.caption || "",
    };
  }

  return issue;
}

async function proxyImage(request: Request): Promise<Response> {
  const sourceParam = new URL(request.url).searchParams.get("url");
  if (!sourceParam) {
    return new Response("Missing 'url' parameter", { status: 400 });
  }

  const sourceUrl = parseSafeImageUrl(sourceParam);
  if (!sourceUrl) {
    return new Response("Unsupported image URL", { status: 400 });
  }

  const cache = caches.default;
  const cacheKey = new Request(request.url, request);
  const cached = await cache.match(cacheKey);
  if (cached) {
    return addCorsHeaders(cached);
  }

  const upstream = await fetch(sourceUrl, { headers: FETCH_HEADERS });
  if (!upstream.ok || !upstream.body) {
    return new Response(`Error proxying image: ${upstream.status}`, {
      status: upstream.status,
    });
  }

  const headers = new Headers(upstream.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Cache-Control", "public, max-age=86400");

  const response = new Response(upstream.body, {
    status: upstream.status,
    headers,
  });

  await cache.put(cacheKey, response.clone());
  return response;
}

function parseSafeImageUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }

    if (isBlockedHost(url.hostname)) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "::1"
  ) {
    return true;
  }

  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }

  const [first, second] = parts;
  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254)
  );
}

function addCorsHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function renderHome(issue: NewspaperIssue, issueNumber: number): string {
  return homeTemplate.replace(
    /\{\{\s*([a-zA-Z0-9_]+)(?:\.([a-zA-Z0-9_]+))?\s*\}\}/g,
    (_match, objectName: string, propertyName?: string) =>
      escapeHtml(getTemplateValue(issue, issueNumber, objectName, propertyName)),
  );
}

function renderArchive(issues: ArchivedIssue[]): string {
  const archiveItems =
    issues.length === 0
      ? '<p class="archive-empty">No archived papers yet. The first paper will appear here after the next refresh.</p>'
      : issues.map(renderArchiveItem).join("");

  return archiveTemplate
    .replace("{{ archive_count }}", String(issues.length))
    .replace("{{ archive_items }}", archiveItems);
}

function renderArchiveItem(issue: ArchivedIssue): string {
  const leadStory = getTemplateStory(issue.issue, "firststory");
  const title = escapeHtml(leadStory?.title || "Untitled issue");
  const article = escapeHtml(truncateText(leadStory?.article || "", 220));
  const image = escapeHtml(formatImageSrc(leadStory?.image || ""));

  return `<a class="archive-entry" href="/archive/${issue.issueNumber}">
    <img class="archive-entry__image" src="${image}" alt=""/>
    <div>
      <div class="archive-entry__meta">Issue #${issue.issueNumber} | ${escapeHtml(issue.publicationDate)}</div>
      <h3>${title}</h3>
      <p>${article}</p>
    </div>
  </a>`;
}

function getTemplateValue(
  issue: NewspaperIssue,
  issueNumber: number,
  objectName: string,
  propertyName?: string,
): string {
  if (objectName === "issue") {
    return String(issueNumber);
  }

  if (objectName === "date") {
    return issue.date;
  }

  if (STORY_KEYS.includes(objectName as StoryKey) && propertyName) {
    const story = getTemplateStory(issue, objectName as StoryKey);
    const value = story?.[propertyName as keyof Story];

    if (propertyName === "image") {
      return formatImageSrc(typeof value === "string" ? value : "");
    }

    if (propertyName === "link") {
      return String(value || "#");
    }

    return String(value ?? "");
  }

  return "";
}

function getTemplateStory(issue: NewspaperIssue, key: StoryKey): Story | undefined {
  return issue[key];
}

function formatImageSrc(value: string): string {
  if (!value) {
    return "/img/TheArcaneObserver.png";
  }

  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return `/proxy-image?url=${encodeURIComponent(url.toString())}`;
    }
  } catch {
    // Local image paths fall through unchanged.
  }

  return value;
}

function extractMetaContent(html: string, property: string): string {
  const metaTags = html.matchAll(/<meta\b[^>]*>/gi);

  for (const tag of metaTags) {
    const name = extractAttribute(tag[0], "name") || extractAttribute(tag[0], "property");
    if (name !== property) {
      continue;
    }

    return decodeHtml(extractAttribute(tag[0], "content"));
  }

  return "";
}

function extractArticleTimestamp(
  html: string,
  metaProperty: string,
  jsonProperty: string,
): string | undefined {
  const metaValue = extractMetaContent(html, metaProperty);
  if (metaValue) {
    return metaValue.endsWith("Z") ? metaValue : `${metaValue}Z`;
  }

  return html.match(new RegExp(`"${jsonProperty}"\\s*:\\s*"([^"]+)"`, "i"))?.[1];
}

function extractAttribute(tag: string, name: string): string {
  const regex = new RegExp(`\\b${name}=["']([^"']*)["']`, "i");
  return tag.match(regex)?.[1] ?? "";
}

function extractAiText(result: AiTextResult): string {
  return (
    (typeof result.response === "string" ? result.response : "") ||
    result.text ||
    result.choices?.[0]?.message?.content ||
    result.choices?.[0]?.text ||
    ""
  );
}

function extractJsonText(text: string): string {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Workers AI did not return a JSON object.");
  }

  return cleaned.slice(start, end + 1);
}

function buildGenerationSystemPrompt(storyKeys: StoryKey[]): string {
  return `You are writing this week's issue of The Arcane Observer, a deadpan satirical newspaper that explains real-world oddities as side effects of hidden wizarding activity.

House style:
- Write like a reporter, not like a fantasy narrator.
- The target voice is a dry broadsheet: concrete reporting first, absurd magical explanation second, with named institutions, expert sources, administrative cover stories, and a final payoff.
- Keep the humor precise, wry, and grounded in the supplied facts.
- For deaths, injuries, disasters, or serious harm, do not turn the victims into the joke. Keep the treatment restrained or focus the satire on the magical bureaucracy around the event.
- Headlines should sell the hidden magical story, not merely paraphrase the AP headline. A reader should understand the comic premise from the headline alone.
- Report the central magical premise as fact. Do not hedge the joke with "may," "might," "suggest," "speculate," or "possible connections."

Every story must:
- Before drafting, privately decide three things: the impossible thing that literally happened, which AP details are evidence of it, and the mundane cover story humans accepted.
- Preserve the real event and reuse at least 3 concrete details from the supplied source summary.
- Reinterpret the visible article as the public-facing cleanup, euphemism, or cover story for a larger magical incident.
- Make the magical incident the real story. Prefer breaches of secrecy, transfigurations, artifacts, curses, cloning accidents, containment exercises, magical law enforcement, or Ministry cover-ups over passive explanations where "a wizard caused the event."
- The hidden incident must materially change what happened. If removing the wizard leaves the AP story basically unchanged, the premise is too weak.
- Do not write stories where magic merely improves luck, raises morale, inspires generosity, guides someone, causes a normal crowd reaction, or gives an ordinary event a fantasy backstory. The magic should create a stranger underlying event with physical, legal, or bureaucratic consequences.
- For animal stories, do not merely say magic helped the animal. Make the animal part of the hidden magical problem: a misfiled familiar, ward error, transformed apprentice, courier spell, escaped registry subject, or containment breach.
- Do not accept the AP headline's interpretation as the interesting part of the story. Treat it as the mundane explanation that hides the more surprising magical incident.
- A strong premise should be pitchable in one sentence even before the article is written.
- Prefer one bold, concrete revelation over a vague suggestion that an object or event "might be magical."
- Invent one specific hidden magical explanation for that event.
- Explain how ordinary humans misunderstood, rationalized, or officially covered up what happened.
- Include at least one concrete piece of wizarding-world specificity: a named magical office, guild, law, expert, ritual, artifact, or bureaucratic consequence.
- End on a pointed payoff, not a generic sentence about magic continuing in the background.

Across the whole issue:
- Vary the magical mechanism, story structure, title structure, and joke from story to story.
- Do not reuse the same kind of wizard, spell, institution, or premise repeatedly.
- Prefer specific nouns, named places, named people, and invented institutions over repeated generic references to "a wizard" or "magic."
- Avoid these stock phrases entirely: "it is believed", "known for", "what they didn't know", "the real reason behind", "behind the scenes", "the wizard's magic continued", and any "restoring balance" ending.
- Avoid title templates like "Wizardly X", "Thanks to Wizard's Y Spell", "Due to Wizard's Y Spell", and "Courtesy of Wizard's Y Spell".
- Avoid generic premise language like "mischievous mage", "unknowingly fueled by", "magical forces at play", or "the real culprit was a wizard."

Editorial example:
- Weak: "Police used Lego heads because mischievous wizards played a prank."
- Stronger: "Police were quietly booking victims of a head-transfiguration spree; LEGO's complaint became the Ministry-approved public explanation before Muggles noticed suspects really had brick heads."
- Weak: "Cardinals fans went shirtless because a mage boosted team morale."
- Stronger: "An apprentice left a clone circle open beneath Busch Stadium, producing rows of near-identical shirtless men before the Office of Multiplicity Control persuaded the club to call them ordinary fans and buy them tickets."
- Weak headline: "St. Louis Cardinals Manager Buys Tickets for Shirtless Fans."
- Stronger headline: "CLONE CIRCLE LEAKS INTO BUSCH STADIUM; Cardinals Buy Seats for Shirtless Duplicates."
- Weak: "A ruby may be magical."
- Stronger: "Miners unearthed an emergency beacon from a buried dragon hoard; gem dealers called it a ruby while the Department of Hoard Reclamation tried to keep the owner asleep."
- Weak: "A wizard helped a coyote swim farther than expected."
- Stronger: "A misfiled familiar-return spell delivered a coyote to Alcatraz because the island's prison wards still listed it as an approved kennel."

Slot lengths:
- firststory is the lead feature: 125-205 words in 3-4 short paragraphs.
- secondstory and thirdstory are secondary features: 95-170 words each in 2-3 short paragraphs.
- all sub-stories are briefs: 65-135 words each in 1-2 compact paragraphs.

Caption:
- firststory needs a specific caption of 2-10 words that could plausibly sit under the photo in this newspaper.
- Do not use generic captions like "Magic", "Bridge Crash", "Wizard", "Wizardry", or "Mystery".

Headline Magical Root Words:
- Headlines MUST contain at least one of these exact magical root words (or their variations) to surface the magical premise: ${MAGICAL_TITLE_ROOT_LIST}.

Return only valid JSON with these top-level keys: ${storyKeys.join(", ")}.
Each key needs "title" and "article"; firststory also needs "caption".
"title", "article", and "caption" must each be plain strings, not arrays or nested objects.
Use this shape exactly:
${buildOutputShapeExample(storyKeys)}`;
}

function buildRevisionPrompt(validationIssues: string[]): string {
  return `Revise the entire issue. The previous draft failed editorial review:
- ${validationIssues.join("\n- ")}

Mandatory repair checklist:
- Remove every banned phrase named above. Do not use hedges such as "may", "might", "suggest", "speculate", or "possible connection".
- If a headline does not surface the magical premise, rewrite it around the actual magical object, action, creature, spell, or institution.
- Every headline must include at least one allowed magical root word: ${MAGICAL_TITLE_ROOT_LIST}.

Return a complete replacement JSON object for every story.`;
}

function buildBatchUserPrompt(
  articleSummaries: ArticleSummaries,
  storyKeys: StoryKey[],
  priorStories: GeneratedStories,
): string {
  const priorStoryNotes = STORY_KEYS.flatMap((key) => {
    const story = priorStories[key];
    return story ? [`- ${key}: ${story.title}`] : [];
  });

  const priorStorySection =
    priorStoryNotes.length === 0
      ? ""
      : `Already written elsewhere in this issue; do not repeat their title structure or implied premise:\n${priorStoryNotes.join(
          "\n",
        )}\n\n`;

  const reminders =
    `\n\nCRITICAL CONSTRAINTS FOR THIS BATCH (Mandatory):\n` +
    storyKeys
      .map((key) => {
        const rule = STORY_LENGTH_RULES[key];
        const captionReminder =
          key === "firststory"
            ? " Also provide a photo caption of 2-10 words (using key 'caption')."
            : "";
        return `- ${key} (${rule.role}): Article body MUST be ${rule.minWords}-${rule.maxWords} words.${captionReminder} Headline MUST contain one of the allowed magical root words (${MAGICAL_TITLE_ROOT_LIST}).`;
      })
      .join("\n");

  return `${priorStorySection}Stories to write:\n${storyKeys
    .map((key) => articleSummaries[key])
    .join("\n\n")}${reminders}`;
}

function buildOutputShapeExample(storyKeys: StoryKey[]): string {
  return JSON.stringify(
    Object.fromEntries(
      storyKeys.map((key) => [
        key,
        key === "firststory"
          ? {
              title: "Headline here",
              article: "Paragraph one.\n\nParagraph two.",
              caption: "Specific caption",
            }
          : {
              title: "Headline here",
              article: "Paragraph one.\n\nParagraph two.",
            },
      ]),
    ),
    null,
    2,
  );
}

function parseGeneratedStories(result: AiTextResult): GeneratedStories {
  if (isRecord(result.response)) {
    return normalizeGeneratedStories(result.response);
  }

  const jsonText = extractJsonText(extractAiText(result));
  return normalizeGeneratedStories(JSON.parse(jsonText) as Record<string, unknown>);
}

function repairGeneratedStories(
  stories: GeneratedStories,
  storyKeys: StoryKey[],
): GeneratedStories {
  const repaired: GeneratedStories = {};

  for (const key of storyKeys) {
    const story = stories[key];
    if (!story) {
      continue;
    }

    repaired[key] = {
      title: repairHeadline(story.title || "", story.article || ""),
      article: repairArticleText(story.article || ""),
      caption:
        key === "firststory"
          ? repairCaption(story.caption || "", story.title || "")
          : story.caption,
    };
  }

  return repaired;
}

function repairArticleText(article: string): string {
  let repaired = article;

  for (const phrase of BANNED_ARTICLE_PHRASES) {
    repaired = repaired.replace(globalizeRegExp(phrase.pattern), phrase.replacement);
  }

  return repaired
    .replace(/\ba wizard\b/gi, "a Ministry caster")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function repairHeadline(title: string, article: string): string {
  let repaired = normalizeWhitespace(title)
    .replace(/^wizardly\b/i, "Arcane")
    .replace(/\bthanks to wizard'?s\b/i, "After Ministry")
    .replace(/\bdue to wizard'?s\b/i, "After Ministry")
    .replace(/\bcourtesy of wizard'?s\b/i, "After Ministry")
    .replace(/\bmischievous mage\b/i, "licensed mage");

  if (!repaired) {
    repaired = "Arcane Inquiry Opens";
  }

  if (!MAGICAL_TITLE_PATTERN.test(repaired)) {
    const premiseWord = normalizeWhitespace(article.match(MAGICAL_TITLE_PATTERN)?.[0] || "");
    const premise = premiseWord ? capitalize(premiseWord) : "Arcane";
    repaired = `${repaired}; ${premise} Inquiry Opens`;
  }

  return repaired;
}

function repairCaption(caption: string, title: string): string {
  const repaired = normalizeWhitespace(caption);
  const wordCount = countWords(repaired);
  if (
    wordCount >= 2 &&
    wordCount <= 10 &&
    !GENERIC_CAPTIONS.has(normalizeForComparison(repaired))
  ) {
    return repaired;
  }

  const titleWord = normalizeWhitespace(title.match(MAGICAL_TITLE_PATTERN)?.[0] || "");
  return titleWord ? `${capitalize(titleWord)} case file` : "Ministry case file";
}

function globalizeRegExp(pattern: RegExp): RegExp {
  return new RegExp(
    pattern.source,
    pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`,
  );
}

function capitalize(value: string): string {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
}

function validateGeneratedStories(
  stories: GeneratedStories,
  storyKeys: StoryKey[],
  enforceIssueWideRules = false,
): string[] {
  const issues: string[] = [];
  let genericWizardMentions = 0;

  for (const key of storyKeys) {
    const story = stories[key];
    if (!story) {
      issues.push(`${key} is missing.`);
      continue;
    }

    const title = typeof story.title === "string" ? normalizeWhitespace(story.title) : "";
    const article = typeof story.article === "string" ? normalizeWhitespace(story.article) : "";
    if (!title) {
      issues.push(`${key} is missing a title.`);
    }
    if (!article) {
      issues.push(`${key} is missing article text.`);
      continue;
    }

    const rule = STORY_LENGTH_RULES[key];
    const wordCount = countWords(article);
    if (wordCount < rule.minWords || wordCount > rule.maxWords) {
      issues.push(
        `${key} (${rule.role}) is ${wordCount} words; expected ${rule.minWords}-${rule.maxWords}.`,
      );
    }

    for (const phrase of BANNED_ARTICLE_PHRASES) {
      if (phrase.pattern.test(article)) {
        issues.push(`${key} uses banned phrase ${phrase.label}.`);
      }
    }

    for (const titlePattern of BANNED_TITLE_PATTERNS) {
      if (titlePattern.pattern.test(title)) {
        issues.push(`${key} uses banned title pattern ${titlePattern.label}.`);
      }
    }
    if (!MAGICAL_TITLE_PATTERN.test(title)) {
      issues.push(`${key} title does not surface the magical premise.`);
    }

    genericWizardMentions += countPatternOccurrences(article, /\ba wizard\b/gi);
  }

  if (enforceIssueWideRules && genericWizardMentions > 4) {
    issues.push(
      `The issue uses the generic phrase "a wizard" ${genericWizardMentions} times; use named characters or institutions instead.`,
    );
  }

  if (storyKeys.includes("firststory")) {
    const caption =
      typeof stories.firststory?.caption === "string"
        ? normalizeWhitespace(stories.firststory.caption)
        : "";
    const captionWordCount = countWords(caption);
    if (captionWordCount < 2 || captionWordCount > 10) {
      issues.push(`firststory caption is ${captionWordCount} words; expected 2-10.`);
    }
    if (GENERIC_CAPTIONS.has(normalizeForComparison(caption))) {
      issues.push(`firststory caption "${caption}" is too generic.`);
    }
  }

  return [...new Set(issues)];
}

function countWords(value: string): number {
  const normalized = normalizeWhitespace(value);
  return normalized ? normalized.split(/\s+/).length : 0;
}

function countPatternOccurrences(value: string, pattern: RegExp): number {
  return Array.from(value.matchAll(pattern)).length;
}

function normalizeForComparison(value: string): string {
  return normalizeWhitespace(value).toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeGeneratedStories(value: Record<string, unknown>): GeneratedStories {
  const stories: GeneratedStories = {};

  for (const key of STORY_KEYS) {
    const story = value[key];
    if (!isRecord(story)) {
      continue;
    }

    stories[key] = {
      title: normalizeGeneratedField(story.title),
      article: normalizeGeneratedField(story.article),
      caption: normalizeGeneratedField(story.caption),
    };
  }

  return stories;
}

function normalizeGeneratedField(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string").join("\n\n");
  }

  return "";
}

function summarizeGeneratedStoryShape(stories: GeneratedStories): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(stories).map(([key, story]) => [
      key,
      story && typeof story === "object"
        ? {
            title: typeof story.title,
            article: typeof story.article,
            articleKeys: isRecord(story.article) ? Object.keys(story.article) : [],
            caption: typeof story.caption,
          }
        : typeof story,
    ]),
  );
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeArticleUrl(value: string): string {
  const url = new URL(value);
  url.search = "";
  url.hash = "";
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

function truncateText(value: string, maxLength: number): string {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

async function findLatestWaybackCapture(
  originalUrl: string,
  cutoffTimestamp: string,
): Promise<WaybackCapture | undefined> {
  const params = new URLSearchParams({
    url: originalUrl,
    matchType: "exact",
    output: "json",
    fl: "timestamp,original,statuscode,mimetype",
    to: cutoffTimestamp,
    limit: "1",
    sort: "reverse",
  });
  params.append("filter", "statuscode:200");
  params.append("filter", "mimetype:text/html");
  const response = await fetch(`https://web.archive.org/cdx/search/cdx?${params}`, {
    headers: FETCH_HEADERS,
  });
  if (!response.ok) {
    throw new Error(`Wayback CDX returned ${response.status}: ${await response.text()}`);
  }

  const rows = (await response.json()) as string[][];
  const row = rows[1];
  if (!row) {
    return undefined;
  }

  return {
    timestamp: row[0],
    original: row[1],
  };
}

function buildWaybackUrl(capture: WaybackCapture): string {
  return `https://web.archive.org/web/${capture.timestamp}id_/${capture.original}`;
}

function parseIssueDate(value: string | undefined): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseWaybackSnapshot(value: string | undefined): string | undefined {
  return value && /^\d{14}$/.test(value) ? value : undefined;
}

function issueNumberForDate(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatWaybackTimestamp(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function timingSafeEqual(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);

  const leftBytes = new Uint8Array(leftHash);
  const rightBytes = new Uint8Array(rightHash);
  let diff = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < leftBytes.length; index += 1) {
    diff |= leftBytes[index] ^ rightBytes[index];
  }

  return diff === 0;
}

function formatDate(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${month}/${day}/${date.getUTCFullYear()}`;
}

export default {
  fetch: app.fetch,
  scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runScheduledRefresh(env));
  },
} satisfies ExportedHandler<Env>;
