// src/messages/pl.ts
const pl = {
  brand: {
    title: "S4S Admin",
    subtitle: "Sieć skautingu"
  },
  theme: {
    light: "Jasny",
    dark: "Ciemny"
  },
  roles: {
    admin: "Admin",
    agent: "Agent",
    scout: "Skaut"
  },
  sections: {
    scout: "Skaut",
    admin: "Admin"
  },
  nav: {
    myPlayers: "Moi zawodnicy",
    observations: "Obserwacje",
    discover: "Odkrywaj",
    addPlayer: "Dodaj zawodnika",
    discoverPlayers: {
      withAgent: "Zawodnicy z agentem",
      withoutAgent: "Zawodnicy bez agenta"
    },
    admin: {
      allPlayers: "Wszyscy zawodnicy",
      duplicates: "Duplikaty",
      scouts: "Skauci",
      scraper: "Skraper zawodników",
      scraperData: "Zeskrobane dane"
    }
  },
  ui: {
    // generic UI
    open: "Otwórz",
    close: "Zamknij",
    na: "—",
    yes: "Tak",
    no: "Nie",

    // app-specific
    closeMenu: "Zamknij menu",
    settings: "Ustawienia",
    signOut: "Wyloguj"
  },
  notifications: {
    title: "Powiadomienia",
    recent: "Ostatnia aktywność",
    empty: "Wszystko nadrobione."
  },
  account: {
    title: "Konto"
  },
  recent: {
    observation: "Utworzono/zaktualizowano obserwację: {title}"
  },

  // ====== Discover page ======
  loading: { loading: "Ładowanie…" },
  actions: {
    retry: "Ponów",
    loadMore: "Załaduj więcej",
    clear: "Wyczyść"
  },
  table: {
    headers: {
      select: "Zaznacz",
      player: "Zawodnik",
      position: "Pozycja",
      club: "Klub",
      country: "Kraj",
      interest: "Zainteresowanie",
      transfermarkt: "Transfermarkt",
      actions: "Akcje"
    },
    selectAria: "Zaznacz {name}"
  },
  discover: {
    search: {
      placeholder: "Szukaj nazwiska zawodnika…",
      aria: "Szukaj lub dodaj zawodnika",
      label: "Szukaj / Dodaj",
      helper:
        "Naciśnij <kbd>Enter</kbd>, aby wyszukać · Użyj <em>Synchronizuj</em>, aby zaimportować z Transfermarkt"
    },
    filters: {
      country: "Kraj",
      reset: "Resetuj filtry",
      clear: "Wyczyść {label}"
    },
    sort: {
      newest: "Najnowsze",
      name: "Nazwa",
      interest: "Zainteresowanie"
    },
    view: {
      cards: "Karty",
      table: "Tabela",
      cardTitle: "Widok kart",
      tableTitle: "Widok tabeli"
    },
    sync: {
      title: "Synchronizacja Transfermarkt:",
      mode: {
        players: "Zawodnicy",
        clubs: "Skład klubu",
        competitions: "Składy rozgrywek"
      },
      synchronize: "Synchronizuj",
      synchronizing: "Synchronizowanie…",
      tip: "Import z Transfermarkt na podstawie bieżącego wyszukiwania",
      missingTip:
        "Uzupełnij brakujące linki Transfermarkt dla istniejących zawodników",
      syncMissing: "Uzupełnij braki",
      syncingMissing: "Uzupełnianie…",
      needName: {
        title: "Najpierw wpisz nazwisko zawodnika",
        desc: "Synchronizacja używa bieżącego zapytania wyszukiwania."
      },
      result: "Zaimportowano {imported} • Dopasowano {matched}",
      bulkResult:
        "Przeskanowano {scanned} • Dopasowano {matched} • Nie znaleziono {notFound}",
      failed: "Błąd synchronizacji",
      bulkFailed: "Błąd zbiorczej synchronizacji"
    },
    results: {
      count:
        "{count, plural, =0 {0 wyników} one {# wynik} few {# wyniki} other {# wyników}}"
    },
    chips: {
      search: "Szukaj: \"{q}\"",
      position: "Poz.: {pos}",
      country: "Kraj: {country}",
      sort: "Sortowanie: {sort}"
    },
    error: {
      prefix: "Błąd:"
    },
    errors: {
      loadFailed: "Nie udało się wczytać zawodników",
      couldNotAdd: "Nie udało się dodać",
      couldNotRemove: "Nie udało się usunąć"
    },
    empty: {
      title: "Nie znaleziono zawodników",
      bodyNoQuery: "Spróbuj zmienić filtry lub zapytanie.",
      bodyQuery:
        "Brak wyników dla <q>{q}</q>. Możesz zaimportować tego zawodnika z Transfermarkt.",
      syncButton: "Synchronizuj „{q}”",
      table:
        "Brak zawodników. Dostosuj filtry lub użyj opcji Synchronizuj, aby zaimportować z Transfermarkt."
    },
    select: "Zaznacz",
    player: {
      unknownClub: "Nieznany klub",
      scouts: "Skauci",
      scoutsTitle: "Skauci są zainteresowani tym zawodnikiem",
      scoutsSr: "Zainteresowanie skautów:"
    },
    actions: {
      inMyPlayersRemove: "W Moich zawodnikach — Usuń",
      addToMyPlayers: "Dodaj do Moich zawodników",
      adding: "Dodawanie…",
      inList: "Na liście",
      add: "Dodaj"
    },
    compare: {
      selected: "{count} zaznaczonych (max {max})",
      compare: "Porównaj",
      clear: "Wyczyść",
      needTwo: "Wybierz co najmniej dwóch zawodników do porównania",
      max: "Maksymalnie {max} zawodników",
      removeOne: "Usuń jednego, aby dodać kolejnego.",
      title: "Porównanie zawodników",
      loading: "Wczytywanie szczegółów…",
      field: "Pole",
      fields: {
        position: "Pozycja",
        club: "Klub",
        country: "Kraj",
        dob: "Data urodzenia",
        height: "Wzrost (cm)",
        weight: "Waga (kg)",
        foot: "Noga",
        marketValue: "Wartość rynkowa (€)",
        transfermarkt: "Transfermarkt"
      }
    }
  }
} as const

export default pl
