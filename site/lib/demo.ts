// GENERATED — sample data shown until `leas sync` pushes real builds.
import type { Snapshot } from "./types";

export const demoSnapshot: Snapshot = {
  "project": "acme-mobile",
  "generatedAt": "2026-08-21T15:39:52.138Z",
  "stats": {
    "total": 34,
    "inFlight": 2,
    "successRate": 0.8387096774193549,
    "medianDurationMs": 519678,
    "last7Days": 18,
    "byPlatform": {
      "android": 19,
      "ios": 15
    },
    "byProfile": {
      "production": 18,
      "preview": 10,
      "development": 6
    },
    "byStatus": {
      "queued": 1,
      "running": 1,
      "succeeded": 26,
      "canceled": 1,
      "failed": 5
    },
    "submitted": 6,
    "daily": [
      {
        "date": "2026-08-08",
        "succeeded": 1,
        "failed": 0,
        "active": 0,
        "canceled": 0,
        "total": 1
      },
      {
        "date": "2026-08-09",
        "succeeded": 0,
        "failed": 0,
        "active": 0,
        "canceled": 0,
        "total": 0
      },
      {
        "date": "2026-08-10",
        "succeeded": 2,
        "failed": 0,
        "active": 0,
        "canceled": 0,
        "total": 2
      },
      {
        "date": "2026-08-11",
        "succeeded": 1,
        "failed": 1,
        "active": 0,
        "canceled": 0,
        "total": 2
      },
      {
        "date": "2026-08-12",
        "succeeded": 4,
        "failed": 0,
        "active": 0,
        "canceled": 0,
        "total": 4
      },
      {
        "date": "2026-08-13",
        "succeeded": 3,
        "failed": 1,
        "active": 0,
        "canceled": 0,
        "total": 4
      },
      {
        "date": "2026-08-14",
        "succeeded": 1,
        "failed": 2,
        "active": 0,
        "canceled": 0,
        "total": 3
      },
      {
        "date": "2026-08-15",
        "succeeded": 0,
        "failed": 0,
        "active": 0,
        "canceled": 0,
        "total": 0
      },
      {
        "date": "2026-08-16",
        "succeeded": 0,
        "failed": 0,
        "active": 0,
        "canceled": 0,
        "total": 0
      },
      {
        "date": "2026-08-17",
        "succeeded": 2,
        "failed": 1,
        "active": 0,
        "canceled": 0,
        "total": 3
      },
      {
        "date": "2026-08-18",
        "succeeded": 2,
        "failed": 0,
        "active": 0,
        "canceled": 1,
        "total": 3
      },
      {
        "date": "2026-08-19",
        "succeeded": 4,
        "failed": 0,
        "active": 0,
        "canceled": 0,
        "total": 4
      },
      {
        "date": "2026-08-20",
        "succeeded": 4,
        "failed": 0,
        "active": 0,
        "canceled": 0,
        "total": 4
      },
      {
        "date": "2026-08-21",
        "succeeded": 2,
        "failed": 0,
        "active": 2,
        "canceled": 0,
        "total": 4
      }
    ]
  },
  "credentials": [
    {
      "id": "ios-provisioning-profile",
      "platform": "ios",
      "kind": "Provisioning profile",
      "profile": "production",
      "identity": "Acme Mobile App Store",
      "expires": "2026-09-09T00:00:00Z",
      "daysLeft": 19,
      "status": "expiring",
      "appId": "com.acme.mobile"
    },
    {
      "id": "ios-distribution-certificate",
      "platform": "ios",
      "kind": "Distribution certificate",
      "profile": "production",
      "identity": "Apple Distribution: Acme Inc (7Q4XK2M9RB)",
      "expires": "2027-10-07T00:00:00Z",
      "daysLeft": 412,
      "status": "ok",
      "fingerprint": "9F2C1A77B0D34E58"
    },
    {
      "id": "android-upload-keystore",
      "platform": "android",
      "kind": "Upload keystore",
      "profile": "production",
      "identity": "alias upload",
      "expires": "2051-12-11T00:00:00Z",
      "daysLeft": 9243,
      "status": "ok"
    }
  ],
  "builds": [
    {
      "id": "bld_live_and01",
      "platform": "android",
      "profile": "production",
      "runner": "cloud",
      "status": "queued",
      "createdAt": "2026-08-21T15:39:09.045Z",
      "startedAt": null,
      "finishedAt": null,
      "durationMs": null,
      "git": {
        "branch": "main",
        "commit": "a3f9c21",
        "message": "Fix push notification deep link on cold start",
        "dirty": false
      },
      "app": {
        "version": "1.4.14",
        "buildNumber": "165"
      },
      "artifact": null,
      "submission": {
        "status": "none",
        "track": null,
        "at": null,
        "error": null
      },
      "error": null,
      "cloud": {
        "runId": 17009002,
        "url": "https://github.com/acme/app/actions"
      }
    },
    {
      "id": "bld_live_ios01",
      "platform": "ios",
      "profile": "production",
      "runner": "cloud",
      "status": "running",
      "createdAt": "2026-08-21T15:35:36.045Z",
      "startedAt": "2026-08-21T15:35:40.045Z",
      "finishedAt": null,
      "durationMs": null,
      "git": {
        "branch": "main",
        "commit": "a3f9c21",
        "message": "Fix push notification deep link on cold start",
        "dirty": false
      },
      "app": {
        "version": "1.4.14",
        "buildNumber": "164"
      },
      "artifact": null,
      "submission": {
        "status": "none",
        "track": null,
        "at": null,
        "error": null
      },
      "error": null,
      "cloud": {
        "runId": 17009001,
        "url": "https://github.com/acme/app/actions"
      }
    },
    {
      "id": "bld_20260821_070181",
      "platform": "android",
      "profile": "production",
      "runner": "cloud",
      "status": "succeeded",
      "createdAt": "2026-08-21T13:58:23.416Z",
      "startedAt": "2026-08-21T13:58:27.416Z",
      "finishedAt": "2026-08-21T14:06:11.201Z",
      "durationMs": 463785,
      "git": {
        "branch": "main",
        "commit": "a3f9c21",
        "message": "Fix push notification deep link on cold start",
        "dirty": false
      },
      "app": {
        "version": "1.4.13",
        "buildNumber": "151"
      },
      "artifact": {
        "path": ".leas/build/android/App.aab",
        "bytes": 33124593,
        "kind": "aab"
      },
      "submission": {
        "status": "submitted",
        "track": "internal",
        "at": "2026-08-21T14:07:37.201Z",
        "error": null
      },
      "error": null,
      "cloud": {
        "runId": 17000031,
        "url": "https://github.com/acme/app/actions"
      }
    },
    {
      "id": "bld_20260821_02ec18",
      "platform": "android",
      "profile": "production",
      "runner": "cloud",
      "status": "succeeded",
      "createdAt": "2026-08-21T10:33:14.383Z",
      "startedAt": "2026-08-21T10:33:18.383Z",
      "finishedAt": "2026-08-21T10:42:04.744Z",
      "durationMs": 526361,
      "git": {
        "branch": "main",
        "commit": "7e21b0d",
        "message": "Bump expo-updates and re-run prebuild",
        "dirty": false
      },
      "app": {
        "version": "1.4.13",
        "buildNumber": "150"
      },
      "artifact": {
        "path": ".leas/build/android/App.aab",
        "bytes": 32748072,
        "kind": "aab"
      },
      "submission": {
        "status": "submitted",
        "track": "internal",
        "at": "2026-08-21T10:43:30.744Z",
        "error": null
      },
      "error": null,
      "cloud": {
        "runId": 17000030,
        "url": "https://github.com/acme/app/actions"
      }
    },
    {
      "id": "bld_20260820_0a6679",
      "platform": "ios",
      "profile": "production",
      "runner": "local",
      "status": "succeeded",
      "createdAt": "2026-08-20T14:33:27.555Z",
      "startedAt": "2026-08-20T14:33:31.555Z",
      "finishedAt": "2026-08-20T14:46:11.466Z",
      "durationMs": 759911,
      "git": {
        "branch": "release/1.4",
        "commit": "2fe6d10",
        "message": "Analytics events for checkout funnel",
        "dirty": false
      },
      "app": {
        "version": "1.4.12",
        "buildNumber": "146"
      },
      "artifact": {
        "path": ".leas/build/ios/App.ipa",
        "bytes": 47184364,
        "kind": "ipa"
      },
      "submission": {
        "status": "none",
        "track": null,
        "at": null,
        "error": null
      },
      "error": null,
      "cloud": null
    },
    {
      "id": "bld_20260820_078bd8",
      "platform": "android",
      "profile": "preview",
      "runner": "cloud",
      "status": "succeeded",
      "createdAt": "2026-08-20T14:24:16.340Z",
      "startedAt": "2026-08-20T14:24:20.340Z",
      "finishedAt": "2026-08-20T14:31:31.973Z",
      "durationMs": 431633,
      "git": {
        "branch": "main",
        "commit": "7e21b0d",
        "message": "Bump expo-updates and re-run prebuild",
        "dirty": false
      },
      "app": {
        "version": "1.4.12",
        "buildNumber": "149"
      },
      "artifact": {
        "path": ".leas/build/android/App.aab",
        "bytes": 33314030,
        "kind": "aab"
      },
      "submission": {
        "status": "none",
        "track": null,
        "at": null,
        "error": null
      },
      "error": null,
      "cloud": {
        "runId": 17000029,
        "url": "https://github.com/acme/app/actions"
      }
    },
    {
      "id": "bld_20260820_02ab7f",
      "platform": "ios",
      "profile": "production",
      "runner": "cloud",
      "status": "succeeded",
      "createdAt": "2026-08-20T12:57:22.138Z",
      "startedAt": "2026-08-20T12:57:26.138Z",
      "finishedAt": "2026-08-20T13:07:52.156Z",
      "durationMs": 626018,
      "git": {
        "branch": "release/1.4",
        "commit": "2fe6d10",
        "message": "Analytics events for checkout funnel",
        "dirty": true
      },
      "app": {
        "version": "1.4.12",
        "buildNumber": "148"
      },
      "artifact": {
        "path": ".leas/build/ios/App.ipa",
        "bytes": 42337378,
        "kind": "ipa"
      },
      "submission": {
        "status": "submitted",
        "track": "TestFlight",
        "at": "2026-08-20T13:09:18.156Z",
        "error": null
      },
      "error": null,
      "cloud": {
        "runId": 17000028,
        "url": "https://github.com/acme/app/actions"
      }
    },
    {
      "id": "bld_20260820_044a99",
      "platform": "ios",
      "profile": "preview",
      "runner": "cloud",
      "status": "succeeded",
      "createdAt": "2026-08-20T09:15:18.859Z",
      "startedAt": "2026-08-20T09:15:22.859Z",
      "finishedAt": "2026-08-20T09:28:04.335Z",
      "durationMs": 761476,
      "git": {
        "branch": "release/1.4",
        "commit": "a3f9c21",
        "message": "Fix push notification deep link on cold start",
        "dirty": false
      },
      "app": {
        "version": "1.4.12",
        "buildNumber": "147"
      },
      "artifact": {
        "path": ".leas/build/ios/App.ipa",
        "bytes": 49979591,
        "kind": "ipa"
      },
      "submission": {
        "status": "none",
        "track": null,
        "at": null,
        "error": null
      },
      "error": null,
      "cloud": {
        "runId": 17000027,
        "url": "https://github.com/acme/app/actions"
      }
    },
    {
      "id": "bld_20260819_0c1062",
      "platform": "ios",
      "profile": "development",
      "runner": "cloud",
      "status": "succeeded",
      "createdAt": "2026-08-19T15:27:41.480Z",
      "startedAt": "2026-08-19T15:27:45.480Z",
      "finishedAt": "2026-08-19T15:42:24.531Z",
      "durationMs": 879051,
      "git": {
        "branch": "main",
        "commit": "b81c447",
        "message": "Upgrade RN, resolve pod conflicts",
        "dirty": true
      },
      "app": {
        "version": "1.4.11",
        "buildNumber": "144"
      },
      "artifact": {
        "path": ".leas/build/ios/App.ipa",
        "bytes": 43743302,
        "kind": "ipa"
      },
      "submission": {
        "status": "none",
        "track": null,
        "at": null,
        "error": null
      },
      "error": null,
      "cloud": {
        "runId": 17000024,
        "url": "https://github.com/acme/app/actions"
      }
    },
    {
      "id": "bld_20260819_088b92",
      "platform": "android",
      "profile": "preview",
      "runner": "cloud",
      "status": "succeeded",
      "createdAt": "2026-08-19T10:21:28.941Z",
      "startedAt": "2026-08-19T10:21:32.941Z",
      "finishedAt": "2026-08-19T10:30:16.590Z",
      "durationMs": 523649,
      "git": {
        "branch": "main",
        "commit": "2fe6d10",
        "message": "Analytics events for checkout funnel",
        "dirty": true
      },
      "app": {
        "version": "1.4.11",
        "buildNumber": "143"
      },
      "artifact": {
        "path": ".leas/build/android/App.aab",
        "bytes": 29213562,
        "kind": "aab"
      },
      "submission": {
        "status": "none",
        "track": null,
        "at": null,
        "error": null
      },
      "error": null,
      "cloud": {
        "runId": 17000023,
        "url": "https://github.com/acme/app/actions"
      }
    },
    {
      "id": "bld_20260819_041f0e",
      "platform": "ios",
      "profile": "production",
      "runner": "cloud",
      "status": "succeeded",
      "createdAt": "2026-08-19T10:14:34.718Z",
      "startedAt": "2026-08-19T10:14:38.718Z",
      "finishedAt": "2026-08-19T10:27:46.661Z",
      "durationMs": 787943,
      "git": {
        "branch": "main",
        "commit": "19bb7f4",
        "message": "Correct Android versionCode after failed submit",
        "dirty": false
      },
      "app": {
        "version": "1.4.11",
        "buildNumber": "142"
      },
      "artifact": {
        "path": ".leas/build/ios/App.ipa",
        "bytes": 44534682,
        "kind": "ipa"
      },
      "submission": {
        "status": "none",
        "track": null,
        "at": null,
        "error": null
      },
      "error": null,
      "cloud": {
        "runId": 17000022,
        "url": "https://github.com/acme/app/actions"
      }
    },
    {
      "id": "bld_20260819_0e52f8",
      "platform": "ios",
      "profile": "preview",
      "runner": "cloud",
      "status": "succeeded",
      "createdAt": "2026-08-19T09:29:26.944Z",
      "startedAt": "2026-08-19T09:29:30.944Z",
      "finishedAt": "2026-08-19T09:38:36.650Z",
      "durationMs": 545706,
      "git": {
        "branch": "main",
        "commit": "2fe6d10",
        "message": "Analytics events for checkout funnel",
        "dirty": false
      },
      "app": {
        "version": "1.4.11",
        "buildNumber": "145"
      },
      "artifact": {
        "path": ".leas/build/ios/App.ipa",
        "bytes": 44667488,
        "kind": "ipa"
      },
      "submission": {
        "status": "none",
        "track": null,
        "at": null,
        "error": null
      },
      "error": null,
      "cloud": {
        "runId": 17000025,
        "url": "https://github.com/acme/app/actions"
      }
    },
    {
      "id": "bld_20260818_053826",
      "platform": "android",
      "profile": "development",
      "runner": "cloud",
      "status": "succeeded",
      "createdAt": "2026-08-18T15:13:29.177Z",
      "startedAt": "2026-08-18T15:13:33.177Z",
      "finishedAt": "2026-08-18T15:20:37.101Z",
      "durationMs": 423924,
      "git": {
        "branch": "main",
        "commit": "a3f9c21",
        "message": "Fix push notification deep link on cold start",
        "dirty": false
      },
      "app": {
        "version": "1.4.10",
        "buildNumber": "141"
      },
      "artifact": {
        "path": ".leas/build/android/App.aab",
        "bytes": 34262158,
        "kind": "aab"
      },
      "submission": {
        "status": "none",
        "track": null,
        "at": null,
        "error": null
      },
      "error": null,
      "cloud": {
        "runId": 17000021,
        "url": "https://github.com/acme/app/actions"
      }
    },
    {
      "id": "bld_20260818_0d6cf7",
      "platform": "android",
      "profile": "preview",
      "runner": "cloud",
      "status": "succeeded",
      "createdAt": "2026-08-18T10:22:19.358Z",
      "startedAt": "2026-08-18T10:22:23.358Z",
      "finishedAt": "2026-08-18T10:29:52.225Z",
      "durationMs": 448867,
      "git": {
        "branch": "main",
        "commit": "5da0e93",
        "message": "Onboarding copy revision",
        "dirty": false
      },
      "app": {
        "version": "1.4.10",
        "buildNumber": "139"
      },
      "artifact": {
        "path": ".leas/build/android/App.aab",
        "bytes": 31993252,
        "kind": "aab"
      },
      "submission": {
        "status": "none",
        "track": null,
        "at": null,
        "error": null
      },
      "error": null,
      "cloud": {
        "runId": 17000019,
        "url": "https://github.com/acme/app/actions"
      }
    },
    {
      "id": "bld_20260818_09391a",
      "platform": "ios",
      "profile": "development",
      "runner": "cloud",
      "status": "canceled",
      "createdAt": "2026-08-18T07:00:14.846Z",
      "startedAt": "2026-08-18T07:00:18.846Z",
      "finishedAt": "2026-08-18T07:14:23.247Z",
      "durationMs": 844401,
      "git": {
        "branch": "main",
        "commit": "a3f9c21",
        "message": "Fix push notification deep link on cold start",
        "dirty": false
      },
      "app": {
        "version": "1.4.10",
        "buildNumber": "140"
      },
      "artifact": null,
      "submission": {
        "status": "none",
        "track": null,
        "at": null,
        "error": null
      },
      "error": null,
      "cloud": {
        "runId": 17000020,
        "url": "https://github.com/acme/app/actions"
      }
    },
    {
      "id": "bld_20260817_00f077",
      "platform": "android",
      "profile": "preview",
      "runner": "local",
      "status": "failed",
      "createdAt": "2026-08-17T15:03:09.320Z",
      "startedAt": "2026-08-17T15:03:13.320Z",
      "finishedAt": "2026-08-17T15:08:42.188Z",
      "durationMs": 131547,
      "git": {
        "branch": "release/1.4",
        "commit": "19bb7f4",
        "message": "Correct Android versionCode after failed submit",
        "dirty": false
      },
      "app": {
        "version": "1.4.9",
        "buildNumber": "136"
      },
      "artifact": null,
      "submission": {
        "status": "none",
        "track": null,
        "at": null,
        "error": null
      },
      "error": "xcodebuild exited with code 65",
      "cloud": null
    },
    {
      "id": "bld_20260817_087f1f",
      "platform": "ios",
      "profile": "preview",
      "runner": "local",
      "status": "succeeded",
      "createdAt": "2026-08-17T14:32:00.623Z",
      "startedAt": "2026-08-17T14:32:04.623Z",
      "finishedAt": "2026-08-17T14:42:57.108Z",
      "durationMs": 652485,
      "git": {
        "branch": "release/1.4",
        "commit": "5da0e93",
        "message": "Onboarding copy revision",
        "dirty": false
      },
      "app": {
        "version": "1.4.9",
        "buildNumber": "138"
      },
      "artifact": {
        "path": ".leas/build/ios/App.ipa",
        "bytes": 48882188,
        "kind": "ipa"
      },
      "submission": {
        "status": "none",
        "track": null,
        "at": null,
        "error": null
      },
      "error": null,
      "cloud": null
    },
    {
      "id": "bld_20260817_0c1b15",
      "platform": "android",
      "profile": "production",
      "runner": "cloud",
      "status": "succeeded",
      "createdAt": "2026-08-17T10:31:51.730Z",
      "startedAt": "2026-08-17T10:31:55.730Z",
      "finishedAt": "2026-08-17T10:39:19.007Z",
      "durationMs": 443277,
      "git": {
        "branch": "release/1.4",
        "commit": "7e21b0d",
        "message": "Bump expo-updates and re-run prebuild",
        "dirty": false
      },
      "app": {
        "version": "1.4.9",
        "buildNumber": "137"
      },
      "artifact": {
        "path": ".leas/build/android/App.aab",
        "bytes": 28696092,
        "kind": "aab"
      },
      "submission": {
        "status": "none",
        "track": null,
        "at": null,
        "error": null
      },
      "error": null,
      "cloud": {
        "runId": 17000017,
        "url": "https://github.com/acme/app/actions"
      }
    },
    {
      "id": "bld_20260814_0d094c",
      "platform": "android",
      "profile": "production",
      "runner": "local",
      "status": "succeeded",
      "createdAt": "2026-08-14T14:03:40.118Z",
      "startedAt": "2026-08-14T14:03:44.118Z",
      "finishedAt": "2026-08-14T14:09:58.864Z",
      "durationMs": 374746,
      "git": {
        "branch": "main",
        "commit": "5da0e93",
        "message": "Onboarding copy revision",
        "dirty": false
      },
      "app": {
        "version": "1.4.6",
        "buildNumber": "135"
      },
      "artifact": {
        "path": ".leas/build/android/App.aab",
        "bytes": 29119095,
        "kind": "aab"
      },
      "submission": {
        "status": "none",
        "track": null,
        "at": null,
        "error": null
      },
      "error": null,
      "cloud": null
    },
    {
      "id": "bld_20260814_08d296",
      "platform": "ios",
      "profile": "production",
      "runner": "local",
      "status": "failed",
      "createdAt": "2026-08-14T13:28:27.611Z",
      "startedAt": "2026-08-14T13:28:31.611Z",
      "finishedAt": "2026-08-14T13:43:01.059Z",
      "durationMs": 347779,
      "git": {
        "branch": "main",
        "commit": "b81c447",
        "message": "Upgrade RN, resolve pod conflicts",
        "dirty": false
      },
      "app": {
        "version": "1.4.6",
        "buildNumber": "134"
      },
      "artifact": null,
      "submission": {
        "status": "none",
        "track": null,
        "at": null,
        "error": null
      },
      "error": "gradlew exited with code 1",
      "cloud": null
    },
    {
      "id": "bld_20260814_069db7",
      "platform": "android",
      "profile": "preview",
      "runner": "cloud",
      "status": "failed",
      "createdAt": "2026-08-14T09:48:29.694Z",
      "startedAt": "2026-08-14T09:48:33.694Z",
      "finishedAt": "2026-08-14T09:57:08.617Z",
      "durationMs": 205969,
      "git": {
        "branch": "release/1.4",
        "commit": "19bb7f4",
        "message": "Correct Android versionCode after failed submit",
        "dirty": false
      },
      "app": {
        "version": "1.4.6",
        "buildNumber": "133"
      },
      "artifact": null,
      "submission": {
        "status": "none",
        "track": null,
        "at": null,
        "error": null
      },
      "error": "xcodebuild exited with code 65",
      "cloud": {
        "runId": 17000013,
        "url": "https://github.com/acme/app/actions"
      }
    },
    {
      "id": "bld_20260813_06dbe5",
      "platform": "android",
      "profile": "development",
      "runner": "cloud",
      "status": "succeeded",
      "createdAt": "2026-08-13T12:54:25.391Z",
      "startedAt": "2026-08-13T12:54:29.391Z",
      "finishedAt": "2026-08-13T13:01:42.818Z",
      "durationMs": 433427,
      "git": {
        "branch": "release/1.4",
        "commit": "2fe6d10",
        "message": "Analytics events for checkout funnel",
        "dirty": true
      },
      "app": {
        "version": "1.4.5",
        "buildNumber": "132"
      },
      "artifact": {
        "path": ".leas/build/android/App.aab",
        "bytes": 32676426,
        "kind": "aab"
      },
      "submission": {
        "status": "none",
        "track": null,
        "at": null,
        "error": null
      },
      "error": null,
      "cloud": {
        "runId": 17000012,
        "url": "https://github.com/acme/app/actions"
      }
    },
    {
      "id": "bld_20260813_0c715d",
      "platform": "ios",
      "profile": "production",
      "runner": "local",
      "status": "failed",
      "createdAt": "2026-08-13T12:15:25.793Z",
      "startedAt": "2026-08-13T12:15:29.793Z",
      "finishedAt": "2026-08-13T12:25:28.646Z",
      "durationMs": 239541,
      "git": {
        "branch": "main",
        "commit": "5da0e93",
        "message": "Onboarding copy revision",
        "dirty": false
      },
      "app": {
        "version": "1.4.5",
        "buildNumber": "130"
      },
      "artifact": null,
      "submission": {
        "status": "none",
        "track": null,
        "at": null,
        "error": null
      },
      "error": "xcodebuild exited with code 65",
      "cloud": null
    },
    {
      "id": "bld_20260813_070dda",
      "platform": "ios",
      "profile": "development",
      "runner": "cloud",
      "status": "succeeded",
      "createdAt": "2026-08-13T10:37:25.545Z",
      "startedAt": "2026-08-13T10:37:29.545Z",
      "finishedAt": "2026-08-13T10:50:41.968Z",
      "durationMs": 792423,
      "git": {
        "branch": "main",
        "commit": "2fe6d10",
        "message": "Analytics events for checkout funnel",
        "dirty": false
      },
      "app": {
        "version": "1.4.5",
        "buildNumber": "129"
      },
      "artifact": {
        "path": ".leas/build/ios/App.ipa",
        "bytes": 49188941,
        "kind": "ipa"
      },
      "submission": {
        "status": "none",
        "track": null,
        "at": null,
        "error": null
      },
      "error": null,
      "cloud": {
        "runId": 17000009,
        "url": "https://github.com/acme/app/actions"
      }
    },
    {
      "id": "bld_20260813_0c903a",
      "platform": "android",
      "profile": "preview",
      "runner": "cloud",
      "status": "succeeded",
      "createdAt": "2026-08-13T06:29:28.705Z",
      "startedAt": "2026-08-13T06:29:32.705Z",
      "finishedAt": "2026-08-13T06:37:16.192Z",
      "durationMs": 463487,
      "git": {
        "branch": "main",
        "commit": "a3f9c21",
        "message": "Fix push notification deep link on cold start",
        "dirty": false
      },
      "app": {
        "version": "1.4.5",
        "buildNumber": "131"
      },
      "artifact": {
        "path": ".leas/build/android/App.aab",
        "bytes": 33546895,
        "kind": "aab"
      },
      "submission": {
        "status": "none",
        "track": null,
        "at": null,
        "error": null
      },
      "error": null,
      "cloud": {
        "runId": 17000011,
        "url": "https://github.com/acme/app/actions"
      }
    },
    {
      "id": "bld_20260812_03eacc",
      "platform": "android",
      "profile": "production",
      "runner": "cloud",
      "status": "succeeded",
      "createdAt": "2026-08-12T12:53:13.620Z",
      "startedAt": "2026-08-12T12:53:17.620Z",
      "finishedAt": "2026-08-12T13:01:53.316Z",
      "durationMs": 515696,
      "git": {
        "branch": "main",
        "commit": "b81c447",
        "message": "Upgrade RN, resolve pod conflicts",
        "dirty": false
      },
      "app": {
        "version": "1.4.4",
        "buildNumber": "128"
      },
      "artifact": {
        "path": ".leas/build/android/App.aab",
        "bytes": 31154513,
        "kind": "aab"
      },
      "submission": {
        "status": "submitted",
        "track": "internal",
        "at": "2026-08-12T13:03:19.316Z",
        "error": null
      },
      "error": null,
      "cloud": {
        "runId": 17000008,
        "url": "https://github.com/acme/app/actions"
      }
    },
    {
      "id": "bld_20260812_06f1d9",
      "platform": "android",
      "profile": "development",
      "runner": "cloud",
      "status": "succeeded",
      "createdAt": "2026-08-12T11:10:44.327Z",
      "startedAt": "2026-08-12T11:10:48.327Z",
      "finishedAt": "2026-08-12T11:16:57.486Z",
      "durationMs": 369159,
      "git": {
        "branch": "release/1.4",
        "commit": "7e21b0d",
        "message": "Bump expo-updates and re-run prebuild",
        "dirty": false
      },
      "app": {
        "version": "1.4.4",
        "buildNumber": "127"
      },
      "artifact": {
        "path": ".leas/build/android/App.aab",
        "bytes": 28008380,
        "kind": "aab"
      },
      "submission": {
        "status": "none",
        "track": null,
        "at": null,
        "error": null
      },
      "error": null,
      "cloud": {
        "runId": 17000007,
        "url": "https://github.com/acme/app/actions"
      }
    },
    {
      "id": "bld_20260812_09a325",
      "platform": "android",
      "profile": "production",
      "runner": "cloud",
      "status": "succeeded",
      "createdAt": "2026-08-12T09:37:30.780Z",
      "startedAt": "2026-08-12T09:37:34.780Z",
      "finishedAt": "2026-08-12T09:43:34.466Z",
      "durationMs": 359686,
      "git": {
        "branch": "main",
        "commit": "19bb7f4",
        "message": "Correct Android versionCode after failed submit",
        "dirty": false
      },
      "app": {
        "version": "1.4.4",
        "buildNumber": "125"
      },
      "artifact": {
        "path": ".leas/build/android/App.aab",
        "bytes": 29536377,
        "kind": "aab"
      },
      "submission": {
        "status": "submitted",
        "track": "internal",
        "at": "2026-08-12T09:45:00.466Z",
        "error": null
      },
      "error": null,
      "cloud": {
        "runId": 17000005,
        "url": "https://github.com/acme/app/actions"
      }
    },
    {
      "id": "bld_20260812_04761c",
      "platform": "ios",
      "profile": "production",
      "runner": "local",
      "status": "succeeded",
      "createdAt": "2026-08-12T07:53:40.105Z",
      "startedAt": "2026-08-12T07:53:44.105Z",
      "finishedAt": "2026-08-12T08:05:22.717Z",
      "durationMs": 698612,
      "git": {
        "branch": "release/1.4",
        "commit": "19bb7f4",
        "message": "Correct Android versionCode after failed submit",
        "dirty": false
      },
      "app": {
        "version": "1.4.4",
        "buildNumber": "126"
      },
      "artifact": {
        "path": ".leas/build/ios/App.ipa",
        "bytes": 46757769,
        "kind": "ipa"
      },
      "submission": {
        "status": "none",
        "track": null,
        "at": null,
        "error": null
      },
      "error": null,
      "cloud": null
    },
    {
      "id": "bld_20260811_06f030",
      "platform": "ios",
      "profile": "production",
      "runner": "cloud",
      "status": "failed",
      "createdAt": "2026-08-11T13:17:25.141Z",
      "startedAt": "2026-08-11T13:17:29.141Z",
      "finishedAt": "2026-08-11T13:30:44.576Z",
      "durationMs": 318174,
      "git": {
        "branch": "main",
        "commit": "19bb7f4",
        "message": "Correct Android versionCode after failed submit",
        "dirty": false
      },
      "app": {
        "version": "1.4.3",
        "buildNumber": "124"
      },
      "artifact": null,
      "submission": {
        "status": "none",
        "track": null,
        "at": null,
        "error": null
      },
      "error": "xcodebuild exited with code 65",
      "cloud": {
        "runId": 17000004,
        "url": "https://github.com/acme/app/actions"
      }
    },
    {
      "id": "bld_20260811_0cd24a",
      "platform": "ios",
      "profile": "production",
      "runner": "cloud",
      "status": "succeeded",
      "createdAt": "2026-08-11T10:04:58.935Z",
      "startedAt": "2026-08-11T10:05:02.935Z",
      "finishedAt": "2026-08-11T10:18:10.929Z",
      "durationMs": 787994,
      "git": {
        "branch": "main",
        "commit": "c04d8a6",
        "message": "Add offline cache for the schedule screen",
        "dirty": false
      },
      "app": {
        "version": "1.4.3",
        "buildNumber": "123"
      },
      "artifact": {
        "path": ".leas/build/ios/App.ipa",
        "bytes": 47739581,
        "kind": "ipa"
      },
      "submission": {
        "status": "none",
        "track": null,
        "at": null,
        "error": null
      },
      "error": null,
      "cloud": {
        "runId": 17000003,
        "url": "https://github.com/acme/app/actions"
      }
    },
    {
      "id": "bld_20260810_052c41",
      "platform": "android",
      "profile": "production",
      "runner": "cloud",
      "status": "succeeded",
      "createdAt": "2026-08-10T08:16:33.681Z",
      "startedAt": "2026-08-10T08:16:37.681Z",
      "finishedAt": "2026-08-10T08:24:58.285Z",
      "durationMs": 500604,
      "git": {
        "branch": "main",
        "commit": "b81c447",
        "message": "Upgrade RN, resolve pod conflicts",
        "dirty": false
      },
      "app": {
        "version": "1.4.2",
        "buildNumber": "122"
      },
      "artifact": {
        "path": ".leas/build/android/App.aab",
        "bytes": 31064621,
        "kind": "aab"
      },
      "submission": {
        "status": "none",
        "track": null,
        "at": null,
        "error": null
      },
      "error": null,
      "cloud": {
        "runId": 17000002,
        "url": "https://github.com/acme/app/actions"
      }
    },
    {
      "id": "bld_20260810_031c7a",
      "platform": "android",
      "profile": "production",
      "runner": "cloud",
      "status": "succeeded",
      "createdAt": "2026-08-10T06:25:25.560Z",
      "startedAt": "2026-08-10T06:25:29.560Z",
      "finishedAt": "2026-08-10T06:30:44.851Z",
      "durationMs": 315291,
      "git": {
        "branch": "release/1.4",
        "commit": "5da0e93",
        "message": "Onboarding copy revision",
        "dirty": true
      },
      "app": {
        "version": "1.4.2",
        "buildNumber": "121"
      },
      "artifact": {
        "path": ".leas/build/android/App.aab",
        "bytes": 34421861,
        "kind": "aab"
      },
      "submission": {
        "status": "submitted",
        "track": "internal",
        "at": "2026-08-10T06:32:10.851Z",
        "error": null
      },
      "error": null,
      "cloud": {
        "runId": 17000001,
        "url": "https://github.com/acme/app/actions"
      }
    },
    {
      "id": "bld_20260808_0f37fd",
      "platform": "android",
      "profile": "preview",
      "runner": "cloud",
      "status": "succeeded",
      "createdAt": "2026-08-08T08:56:31.370Z",
      "startedAt": "2026-08-08T08:56:35.370Z",
      "finishedAt": "2026-08-08T09:05:15.048Z",
      "durationMs": 519678,
      "git": {
        "branch": "main",
        "commit": "a3f9c21",
        "message": "Fix push notification deep link on cold start",
        "dirty": false
      },
      "app": {
        "version": "1.4.0",
        "buildNumber": "120"
      },
      "artifact": {
        "path": ".leas/build/android/App.aab",
        "bytes": 35942081,
        "kind": "aab"
      },
      "submission": {
        "status": "none",
        "track": null,
        "at": null,
        "error": null
      },
      "error": null,
      "cloud": {
        "runId": 17000000,
        "url": "https://github.com/acme/app/actions"
      }
    }
  ],
  "updates": [
    {
      "id": "33333333-3333-3333-3333-333333333333",
      "channel": "production",
      "channels": [
        "production"
      ],
      "runtimeVersion": "1.4.0",
      "platforms": [
        "ios",
        "android"
      ],
      "message": "Broken checkout change",
      "createdAt": "2026-08-21T15:34:50.096Z",
      "git": {
        "branch": "main",
        "commit": "3333333"
      },
      "bytes": 1000000,
      "assetCount": 2,
      "live": false
    },
    {
      "id": "44444444-4444-4444-4444-444444444444",
      "channel": "preview",
      "channels": [
        "preview",
        "production"
      ],
      "runtimeVersion": "1.4.0",
      "platforms": [
        "ios",
        "android"
      ],
      "message": "Experimental nav",
      "createdAt": "2026-08-21T15:09:50.097Z",
      "git": {
        "branch": "main",
        "commit": "4444444"
      },
      "bytes": 1000000,
      "assetCount": 2,
      "promotedFrom": "preview",
      "promotedAt": "2026-08-21T15:39:50.100Z",
      "live": true
    },
    {
      "id": "22222222-2222-2222-2222-222222222222",
      "channel": "production",
      "channels": [
        "production"
      ],
      "runtimeVersion": "1.4.0",
      "platforms": [
        "ios",
        "android"
      ],
      "message": "Add offline cache",
      "createdAt": "2026-08-21T14:39:50.094Z",
      "git": {
        "branch": "main",
        "commit": "2222222"
      },
      "bytes": 1000000,
      "assetCount": 2,
      "live": false
    },
    {
      "id": "11111111-1111-1111-1111-111111111111",
      "channel": "production",
      "channels": [
        "production"
      ],
      "runtimeVersion": "1.4.0",
      "platforms": [
        "ios",
        "android"
      ],
      "message": "Initial release",
      "createdAt": "2026-08-21T12:39:50.092Z",
      "git": {
        "branch": "main",
        "commit": "1111111"
      },
      "bytes": 1000000,
      "assetCount": 2,
      "live": false
    }
  ]
};
