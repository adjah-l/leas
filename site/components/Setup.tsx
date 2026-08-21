'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import * as G from '@/lib/generate';
import type { Answers, Field, Platform } from '@/lib/generate';

const STORAGE_KEY = 'leas.setup.v2';

type StepId = 'project' | 'apple' | 'google' | 'fleet' | 'files';
type Step = { id: StepId; title: string; blurb: string };

/* --------------------------------- shell --------------------------------- */

export default function Setup() {
  const [a, setA] = useState<Answers>(G.DEFAULT_ANSWERS);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [at, setAt] = useState<StepId>('project');
  const [loaded, setLoaded] = useState(false);

  // Restore prior progress. Storage can throw outright in a locked-down
  // browser, so every access is guarded and an empty read is a valid outcome.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.a) setA({ ...G.DEFAULT_ANSWERS, ...saved.a });
        if (saved?.done) setDone(saved.done);
      }
    } catch {
      /* no saved state — start clean */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ a, done }));
    } catch {
      /* private mode or blocked storage — the wizard still works, it just forgets */
    }
  }, [a, done, loaded]);

  const set = <K extends keyof Answers>(k: K, v: Answers[K]) => setA((p) => ({ ...p, [k]: v }));
  const errs = useMemo(() => G.errors(a), [a]);
  const gaps = useMemo(() => G.missing(a), [a]);

  const steps: Step[] = useMemo(() => {
    const s: Step[] = [
      { id: 'project', title: 'Your app', blurb: 'Identifiers and platforms' },
    ];
    if (G.has(a, 'ios')) s.push({ id: 'apple', title: 'Apple', blurb: 'Certificate, profile, API key' });
    if (G.has(a, 'android')) s.push({ id: 'google', title: 'Google', blurb: 'Keystore and service account' });
    s.push({ id: 'fleet', title: 'Where it runs', blurb: 'Your Mac, rented Macs, or both' });
    s.push({ id: 'files', title: 'Your files', blurb: 'Copy them into the repo' });
    return s;
  }, [a]);

  const idx = Math.max(0, steps.findIndex((s) => s.id === at));
  const step = steps[idx] ?? steps[0];

  const go = (id: StepId) => {
    setAt(id);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const reset = () => {
    setA(G.DEFAULT_ANSWERS);
    setDone({});
    go('project');
  };

  const check = (key: string) => setDone((p) => ({ ...p, [key]: !p[key] }));

  return (
    <div className="wizwrap">
      <header className="wizhead">
        <div className="eyebrow">Setup wizard</div>
        <h1>Own your pipeline in ten minutes.</h1>
        <p className="lede">
          Answer a few questions and walk away with a working <code>leas.json</code>, your
          GitHub Actions workflows, and a one-shot script that loads your signing material
          into your own repo&rsquo;s secrets.
        </p>
        <p className="privacy">
          <b>Nothing you type here leaves your browser.</b> This page has no server half — it
          generates text, and your certificates and keys never touch it. That is not a policy
          you have to trust; there is no upload endpoint to trust.
        </p>
      </header>

      <div className="wiz">
        <nav className="wizrail" aria-label="Setup steps">
          <div className="h">Steps</div>
          <ol>
            {steps.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => go(s.id)}
                  data-on={s.id === step.id ? '1' : '0'}
                >
                  <span className="n">{String(i + 1).padStart(2, '0')}</span>
                  <span className="t">
                    {s.title}
                    <em>{s.blurb}</em>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <button type="button" className="linkish" onClick={reset}>
            Start over
          </button>
        </nav>

        <main className="wizmain">
          {step.id === 'project' && <ProjectStep a={a} set={set} errs={errs} />}
          {step.id === 'apple' && (
            <AppleStep a={a} set={set} errs={errs} done={done} check={check} />
          )}
          {step.id === 'google' && (
            <GoogleStep a={a} set={set} done={done} check={check} />
          )}
          {step.id === 'fleet' && <FleetStep a={a} set={set} errs={errs} />}
          {step.id === 'files' && <FilesStep a={a} gaps={gaps} onFix={() => go('project')} />}

          <div className="wiznav">
            <button
              type="button"
              className="btn ghost"
              disabled={idx === 0}
              onClick={() => go(steps[idx - 1].id)}
            >
              Back
            </button>
            {idx < steps.length - 1 && (
              <button type="button" className="btn" onClick={() => go(steps[idx + 1].id)}>
                {steps[idx + 1].title === 'Your files' ? 'Generate files' : `Next: ${steps[idx + 1].title}`}
              </button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

/* --------------------------------- fields -------------------------------- */

type SetFn = <K extends keyof Answers>(k: K, v: Answers[K]) => void;

function Fld(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: React.ReactNode;
  error?: string;
  placeholder?: string;
  mono?: boolean;
  wide?: boolean;
}) {
  const { label, value, onChange, hint, error, placeholder, mono = true, wide } = props;
  return (
    <div className={`fld${wide ? ' wide' : ''}`}>
      <label>
        <span className="l">{label}</span>
        <input
          className={mono ? 'mono' : undefined}
          value={value}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
        />
      </label>
      {error ? <span className="err">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

function Chips<T extends string>(props: {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (v: T) => void;
  hint?: React.ReactNode;
}) {
  return (
    <div className="fld wide">
      <span className="l">{props.label}</span>
      <div className="chips">
        {props.options.map((o) => (
          <button
            key={o.value}
            type="button"
            className="chip"
            aria-pressed={props.selected.includes(o.value)}
            onClick={() => props.onToggle(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {props.hint && <span className="hint">{props.hint}</span>}
    </div>
  );
}

function Task(props: { id: string; done: Record<string, boolean>; check: (k: string) => void; children: React.ReactNode }) {
  return (
    <li className={props.done[props.id] ? 'on' : undefined}>
      <label>
        <input
          type="checkbox"
          checked={!!props.done[props.id]}
          onChange={() => props.check(props.id)}
        />
        <span>{props.children}</span>
      </label>
    </li>
  );
}

/* ---------------------------------- steps -------------------------------- */

function ProjectStep({ a, set, errs }: { a: Answers; set: SetFn; errs: Partial<Record<Field, string>> }) {
  const togglePlatform = (p: Platform) => {
    const next = a.platforms.includes(p) ? a.platforms.filter((x) => x !== p) : [...a.platforms, p];
    if (next.length) set('platforms', next as Platform[]);
  };
  return (
    <section className="wizstep">
      <h2>Your app</h2>
      <p className="sub">
        These are the identifiers Apple and Google already know your app by. If you have an{' '}
        <code>app.json</code>, they are in it.
      </p>

      <div className="fldgrid">
        <Fld
          label="App name"
          value={a.appName}
          onChange={(v) => set('appName', v)}
          placeholder="Kaya"
          mono={false}
          hint="Only used to label the generated files."
        />
        <Chips
          label="Platforms"
          options={[
            { value: 'ios' as Platform, label: 'iOS' },
            { value: 'android' as Platform, label: 'Android' },
          ]}
          selected={a.platforms}
          onToggle={togglePlatform}
          hint="Turning one off removes its whole branch — steps, files, and secrets."
        />
        {G.has(a, 'ios') && (
          <Fld
            label="iOS bundle identifier"
            value={a.bundleId}
            onChange={(v) => set('bundleId', v)}
            placeholder="com.yourcompany.app"
            error={errs.bundleId}
            hint="Must match the App ID your provisioning profile was issued for."
          />
        )}
        {G.has(a, 'android') && (
          <Fld
            label="Android package name"
            value={a.packageName}
            onChange={(v) => set('packageName', v)}
            placeholder="com.yourcompany.app"
            error={errs.packageName}
            hint="Permanent once published — Play will not let you change it."
          />
        )}
      </div>

      <div className="note">
        <span className="note-l">Before you build locally</span>
        <p>
          iOS builds need Xcode with its command line tools; Android builds need a JDK 17 and the
          Android SDK. Cloud builds bring their own, so you can skip both if you only build on the
          fleet.
        </p>
      </div>
    </section>
  );
}

function AppleStep({
  a, set, errs, done, check,
}: {
  a: Answers; set: SetFn; errs: Partial<Record<Field, string>>;
  done: Record<string, boolean>; check: (k: string) => void;
}) {
  return (
    <section className="wizstep">
      <h2>Apple</h2>
      <p className="sub">
        Three artifacts: a certificate that proves the binary is yours, a provisioning profile that
        ties it to an App ID, and an API key that lets <code>leas submit</code> talk to App Store
        Connect without your password.
      </p>

      <ol className="checklist">
        <Task id="apple-app" done={done} check={check}>
          Create the app record in{' '}
          <a href="https://appstoreconnect.apple.com/apps" target="_blank" rel="noreferrer">
            App Store Connect
          </a>{' '}
          if it does not exist. <b>Submission fails without it</b> — there is nothing to upload to.
        </Task>
        <Task id="apple-cert" done={done} check={check}>
          Generate an <b>Apple Distribution</b> certificate at{' '}
          <a href="https://developer.apple.com/account/resources/certificates/list" target="_blank" rel="noreferrer">
            Certificates
          </a>
          , install it, then export it from Keychain Access as a <code>.p12</code> with a password.
        </Task>
        <Task id="apple-profile" done={done} check={check}>
          Create an <b>App Store</b> provisioning profile for{' '}
          <code>{a.bundleId || 'your bundle id'}</code> at{' '}
          <a href="https://developer.apple.com/account/resources/profiles/list" target="_blank" rel="noreferrer">
            Profiles
          </a>{' '}
          and download it.
        </Task>
        <Task id="apple-key" done={done} check={check}>
          In App Store Connect &rarr; Users and Access &rarr;{' '}
          <a href="https://appstoreconnect.apple.com/access/integrations/api" target="_blank" rel="noreferrer">
            Integrations &rarr; App Store Connect API
          </a>
          , generate a team key with the <b>App Manager</b> role. The <code>.p8</code> downloads{' '}
          <b>exactly once</b> — losing it means revoking and starting over.
        </Task>
      </ol>

      <h3>What the key page shows you</h3>
      <div className="fldgrid">
        <Fld
          label="App Store Connect app ID"
          value={a.ascAppId}
          onChange={(v) => set('ascAppId', v)}
          placeholder="1234567890"
          error={errs.ascAppId}
          hint="The numeric Apple ID on the app's App Information page."
        />
        <Fld
          label="API key ID"
          value={a.ascKeyId}
          onChange={(v) => set('ascKeyId', v.toUpperCase())}
          placeholder="ABCD1234EF"
          error={errs.ascKeyId}
          hint="The Key ID column, next to the key you just made."
        />
        <Fld
          label="Issuer ID"
          value={a.ascIssuerId}
          onChange={(v) => set('ascIssuerId', v)}
          placeholder="69a6de70-0000-0000-0000-000000000000"
          error={errs.ascIssuerId}
          wide
          hint="One per team, shown above the key list."
        />
      </div>

      <h3>Where the files go</h3>
      <p className="sub">
        Anything under <code>credentials/</code> stays on your machine — the generated{' '}
        <code>.gitignore</code> keeps it out of the repo.
      </p>
      <div className="fldgrid">
        <Fld
          label="Distribution certificate"
          value={a.certPath}
          onChange={(v) => set('certPath', v)}
          hint="The .p12 you exported from Keychain Access."
        />
        <Fld
          label="Provisioning profile"
          value={a.profilePath}
          onChange={(v) => set('profilePath', v)}
          hint="The .mobileprovision you downloaded."
        />
      </div>
      <p className="sub">
        The API key is expected at <code className="strong">{G.ascKeyPath(a)}</code> — rename the
        downloaded file to match, or edit the path in the generated <code>leas.json</code>.
      </p>

      <div className="note apple">
        <span className="note-l">Expiry</span>
        <p>
          Distribution certificates last three years and provisioning profiles last one. Both
          expire on the morning you need to ship a hotfix. Put the profile&rsquo;s expiry date in
          your calendar now, while you are looking at it.
        </p>
      </div>
    </section>
  );
}

function GoogleStep({
  a, set, done, check,
}: {
  a: Answers; set: SetFn;
  done: Record<string, boolean>; check: (k: string) => void;
}) {
  return (
    <section className="wizstep">
      <h2>Google</h2>
      <p className="sub">
        Two artifacts: an upload keystore that signs the bundle, and a service account that lets{' '}
        <code>leas submit</code> drive the Play Developer API.
      </p>

      <ol className="checklist">
        <Task id="g-keystore" done={done} check={check}>
          Create an upload keystore if you do not have one — the command is below. <b>Back it
          up.</b> Losing it means asking Google to reset your upload key.
        </Task>
        <Task id="g-sa" done={done} check={check}>
          In the{' '}
          <a href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" rel="noreferrer">
            Google Cloud console
          </a>
          , create a service account and download a JSON key for it.
        </Task>
        <Task id="g-invite" done={done} check={check}>
          In{' '}
          <a href="https://play.google.com/console" target="_blank" rel="noreferrer">
            Play Console
          </a>{' '}
          &rarr; Users and permissions, invite that service account&rsquo;s email address and grant
          it <b>Release apps to testing tracks</b> (and production, if you release that way).
        </Task>
        <Task id="g-first" done={done} check={check}>
          Upload your first <code>.aab</code> through the Play Console by hand. <b>Google rejects
          API uploads until a build exists</b>, so the very first release cannot be automated.
        </Task>
      </ol>

      <h3>Creating the keystore</h3>
      <Code body={G.keytoolCommand(a)} name="keytool" />

      <h3>Where the files go</h3>
      <div className="fldgrid">
        <Fld
          label="Upload keystore"
          value={a.keystorePath}
          onChange={(v) => set('keystorePath', v)}
          hint="Never commit this. Back it up somewhere you will still have in five years."
        />
        <Fld
          label="Key alias"
          value={a.keyAlias}
          onChange={(v) => set('keyAlias', v)}
          placeholder="upload"
          hint="Must match the -alias you passed to keytool."
        />
        <Fld
          label="Play service account key"
          value={a.serviceAccountPath}
          onChange={(v) => set('serviceAccountPath', v)}
          hint="The JSON file from Google Cloud."
        />
        <div className="fld">
          <span className="l">Release track</span>
          <div className="chips">
            {['internal', 'alpha', 'beta', 'production'].map((t) => (
              <button
                key={t}
                type="button"
                className="chip"
                aria-pressed={a.track === t}
                onClick={() => set('track', t)}
              >
                {t}
              </button>
            ))}
          </div>
          <span className="hint">Start on internal. You can promote inside Play afterwards.</span>
        </div>
      </div>

      <div className="note android">
        <span className="note-l">How leas signs Android</span>
        <p>
          The Expo template signs release builds with the debug keystore. Rather than patching your{' '}
          <code>build.gradle</code>, leas builds normally and re-signs the artifact with your real
          upload key. Your gradle files are left alone.
        </p>
      </div>
    </section>
  );
}

function FleetStep({ a, set, errs }: { a: Answers; set: SetFn; errs: Partial<Record<Field, string>> }) {
  return (
    <section className="wizstep">
      <h2>Where it runs</h2>
      <p className="sub">
        A cloud build is not a separate system. <code>leas build --cloud</code> dispatches a GitHub
        Actions job whose body is literally <code>leas build --local</code> on a rented Mac. One
        engine, two machines — so they cannot drift apart.
      </p>

      <div className="fldgrid">
        <div className="fld wide">
          <span className="l">Build machines</span>
          <div className="chips">
            <button type="button" className="chip" aria-pressed={!a.cloud} onClick={() => set('cloud', false)}>
              My machine only
            </button>
            <button type="button" className="chip" aria-pressed={a.cloud} onClick={() => set('cloud', true)}>
              My machine + rented Macs
            </button>
          </div>
          <span className="hint">
            Local needs a Mac with Xcode for iOS. Rented adds GitHub Actions workflows and repo
            secrets, and costs per minute.
          </span>
        </div>

        {a.cloud && (
          <Fld
            label="GitHub repository"
            value={a.repo}
            onChange={(v) => set('repo', v)}
            placeholder="yourname/yourapp"
            error={errs.repo}
            wide
            hint="Where the workflows live and the secrets get stored."
          />
        )}

        <div className="fld wide">
          <span className="l">Submit to the stores after a successful build</span>
          <div className="chips">
            <button type="button" className="chip" aria-pressed={a.autoSubmit} onClick={() => set('autoSubmit', true)}>
              Yes — build and ship
            </button>
            <button type="button" className="chip" aria-pressed={!a.autoSubmit} onClick={() => set('autoSubmit', false)}>
              No — just produce the artifact
            </button>
          </div>
          <span className="hint">
            Off means no API keys are needed at all. You can turn it on later by filling in the
            submit block.
          </span>
        </div>

        {a.cloud && (
          <Fld
            label="Node version on the runners"
            value={a.nodeVersion}
            onChange={(v) => set('nodeVersion', v)}
            placeholder="22"
            hint="Match what you develop against."
          />
        )}
      </div>

      <h3>The hosted dashboard</h3>
      <p className="sub">
        Optional. <code>leas dashboard</code> already runs locally against{' '}
        <code>.leas/builds/</code>. If you deploy this site yourself, <code>leas sync</code> pushes
        the same snapshot to it so build history outlives your laptop.
      </p>
      <Fld
        label="Your dashboard URL"
        value={a.syncUrl}
        onChange={(v) => set('syncUrl', v)}
        placeholder="https://leas.yourcompany.com"
        error={errs.syncUrl}
        wide
        hint={<>Leave blank to skip. See <Link href="/docs/dash">the dashboard docs</Link>.</>}
      />
      {a.syncUrl.trim() && <Code body={G.syncSnippet(a)} name="shell" />}
    </section>
  );
}

function FilesStep({ a, gaps, onFix }: { a: Answers; gaps: Field[]; onFix: () => void }) {
  const generated = useMemo(() => G.files(a), [a]);
  const [tab, setTab] = useState(0);
  const active = generated[Math.min(tab, generated.length - 1)];

  return (
    <section className="wizstep">
      <h2>Your files</h2>
      <p className="sub">
        Drop these into your project root. Everything was generated in this tab from what you
        typed — you can read every line before you run it.
      </p>

      {gaps.length > 0 && (
        <div className="note warn">
          <span className="note-l">Placeholders remain</span>
          <p>
            {gaps.length} required {gaps.length === 1 ? 'value is' : 'values are'} still blank, so
            the files below contain <code>REPLACE_</code> markers. They are still safe to save —
            fill the gaps and the text updates.{' '}
            <button type="button" className="linkish" onClick={onFix}>
              Go back and finish
            </button>
          </p>
        </div>
      )}

      <div className="filetabs" role="tablist">
        {generated.map((f, i) => (
          <button
            key={f.name}
            type="button"
            role="tab"
            aria-selected={i === tab}
            className="filetab"
            onClick={() => setTab(i)}
          >
            {f.name}
          </button>
        ))}
      </div>

      {active && (
        <>
          <p className="filenote">{active.note}</p>
          <Code body={active.body} name={active.name} download />
        </>
      )}

      <h3>Then run</h3>
      <p className="sub">
        {a.cloud
          ? 'The secrets script first — it needs the credential files in place. Then leas doctor, which checks every credential, identifier, and secret in about two seconds and tells you exactly what is wrong before a build ever starts.'
          : 'Start with leas doctor. It checks every credential and identifier in about two seconds and tells you exactly what is wrong before a build ever starts.'}
      </p>
      {a.cloud && <Code body={'chmod +x leas-secrets.sh\n./leas-secrets.sh'} name="shell" />}
      <Code body={G.nextSteps(a)} name="shell" />

      <div className="note">
        <span className="note-l">If the first build fails</span>
        <p>
          Run <code>leas doctor</code> — it catches the usual cause, which is a mismatch between
          the bundle identifier and the App ID the provisioning profile was issued for.{' '}
          <Link href="/docs/broken">Troubleshooting</Link> walks the failures in the order they
          actually happen.
        </p>
      </div>
    </section>
  );
}

/* --------------------------------- code box -------------------------------- */

function Code({ body, name, download }: { body: string; name: string; download?: boolean }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — the text is selectable, which is the fallback */
    }
  };

  const save = () => {
    const blob = new Blob([body], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const el = document.createElement('a');
    el.href = url;
    el.download = name.split('/').pop() || 'leas.txt';
    document.body.appendChild(el);
    el.click();
    el.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="codebox">
      <div className="codebar">
        <span className="cname">{name}</span>
        <button type="button" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
        {download && <button type="button" onClick={save}>Download</button>}
      </div>
      <pre>{body}</pre>
    </div>
  );
}
