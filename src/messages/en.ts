// src/messages/en.ts
const en = {
  brand: {
    title: "S4S Admin",
    subtitle: "Scouting Network"
  },
  theme: {
    light: "Light",
    dark: "Dark"
  },
  roles: {
    admin: "Admin",
    agent: "Agent",
    scout: "Scout"
  },
  sections: {
    scout: "Scout",
    admin: "Admin"
  },
  nav: {
    myPlayers: "My Players",
    observations: "Observations",
    discover: "Discover",
    addPlayer: "Add Player",
    discoverPlayers: {
      withAgent: "Players with agent",
      withoutAgent: "Players without agent"
    },
    admin: {
      allPlayers: "All Players",
      duplicates: "Duplicates",
      scouts: "Scouts",
      scraper: "Players Scraper",
      scraperData: "Scraped data"
    }
  },
  ui: {
    // generic UI
    open: "Open",
    close: "Close",
    na: "—",
    yes: "Yes",
    no: "No",

    // app-specific
    closeMenu: "Close menu",
    settings: "Settings",
    signOut: "Sign out"
  },
  notifications: {
    title: "Notifications",
    recent: "Recent activity",
    empty: "You’re all caught up."
  },
  account: {
    title: "Account"
  },
  recent: {
    observation: "Created/updated observation: {title}"
  },

  // ====== Discover page ======
  loading: { loading: "Loading…" },
  actions: {
    retry: "Retry",
    loadMore: "Load more",
    clear: "Clear"
  },
  table: {
    headers: {
      select: "Select",
      player: "Player",
      position: "Position",
      club: "Club",
      country: "Country",
      interest: "Interest",
      transfermarkt: "Transfermarkt",
      actions: "Actions"
    },
    selectAria: "Select {name}"
  },
  discover: {
    search: {
      placeholder: "Search player name…",
      aria: "Search or add player",
      label: "Search / Add",
      helper:
        "Press <kbd>Enter</kbd> to search · Use <em>Synchronize</em> to import from Transfermarkt"
    },
    filters: {
      country: "Country",
      reset: "Reset filters",
      clear: "Clear {label}"
    },
    sort: {
      newest: "Newest",
      name: "Name",
      interest: "Interest"
    },
    view: {
      cards: "Cards",
      table: "Table",
      cardTitle: "Card view",
      tableTitle: "Table view"
    },
    sync: {
      title: "Transfermarkt sync:",
      mode: {
        players: "Players",
        clubs: "Club squad",
        competitions: "Competition squads"
      },
      synchronize: "Synchronize",
      synchronizing: "Synchronizing…",
      tip: "Import from Transfermarkt using current Search",
      missingTip: "Sync missing Transfermarkt links for existing players",
      syncMissing: "Sync Missing",
      syncingMissing: "Syncing Missing…",
      needName: {
        title: "Type a player name first",
        desc: "Synchronize uses your current search query."
      },
      result: "Imported {imported} • Matched {matched}",
      bulkResult: "Scanned {scanned} • Matched {matched} • Not found {notFound}",
      failed: "Sync failed",
      bulkFailed: "Bulk sync failed"
    },
    results: {
      count: "{count, plural, =0 {0 results} one {# result} other {# results}}"
    },
    chips: {
      search: "Search: \"{q}\"",
      position: "Pos: {pos}",
      country: "Country: {country}",
      sort: "Sort: {sort}"
    },
    error: {
      prefix: "Error:"
    },
    errors: {
      loadFailed: "Failed to load players",
      couldNotAdd: "Could not add",
      couldNotRemove: "Could not remove"
    },
    empty: {
      title: "No players found",
      bodyNoQuery: "Try adjusting your filters or search query.",
      bodyQuery:
        "No results for <q>{q}</q>. You can import this player from Transfermarkt.",
      syncButton: "Synchronize “{q}”",
      table:
        "No players found. Adjust filters or use Synchronize to import from Transfermarkt."
    },
    select: "Select",
    player: {
      unknownClub: "Unknown club",
      scouts: "Scouts",
      scoutsTitle: "Scouts are interested in this player",
      scoutsSr: "Scouts interested:"
    },
    actions: {
      inMyPlayersRemove: "In My Players — Remove",
      addToMyPlayers: "Add to My Players",
      adding: "Adding…",
      inList: "In list",
      add: "Add"
    },
    compare: {
      selected: "{count} selected (max {max})",
      compare: "Compare",
      clear: "Clear",
      needTwo: "Pick at least two players to compare",
      max: "Max {max} players",
      removeOne: "Remove one before adding another.",
      title: "Compare players",
      loading: "Loading details…",
      field: "Field",
      fields: {
        position: "Position",
        club: "Club",
        country: "Country",
        dob: "Date of Birth",
        height: "Height (cm)",
        weight: "Weight (kg)",
        foot: "Foot",
        marketValue: "Market value (€)",
        transfermarkt: "Transfermarkt"
      }
    }
  }
} as const

export default en
