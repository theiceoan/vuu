import { Filter } from "@finos/vuu-filter-types";
import {
  addFilter,
  filterAsQuery,
  FilterInput,
  FilterSaveOptions,
  FilterToolbar,
  updateFilter,
  useFilterSuggestionProvider,
} from "@finos/vuu-filters";
import { useCallback, useEffect, useMemo, useState } from "react";
import { JsonTable } from "@finos/vuu-datatable";

import {
  authenticate as vuuAuthenticate,
  connectToServer,
} from "@finos/vuu-data";
import {} from "@finos/vuu-utils";
import {
  ApplyCompletion,
  FilterSubmissionMode,
} from "@finos/vuu-filters/src/filter-input/useFilterAutoComplete";

let displaySequence = 1;

const table = { module: "SIMUL", table: "instruments" };

const schemaColumns = [
  { name: "bbg", serverDataType: "string" } as const,
  { name: "description", serverDataType: "string" } as const,
  { name: "currency", serverDataType: "string" } as const,
  { name: "exchange", serverDataType: "string" } as const,
  { name: "lotSize", serverDataType: "int" } as const,
  { name: "isin", serverDataType: "string" } as const,
  { name: "ric", serverDataType: "string" } as const,
];

export const DefaultFilterInput = () => {
  type FilterState = {
    filter: Filter | undefined;
    filterQuery: string;
    filterName?: string;
  };

  const namedFilters = useMemo(() => new Map<string, string>(), []);
  const [filterState, setFilterState] = useState<FilterState>({
    filter: undefined,
    filterQuery: "",
  });
  const suggestionProvider = useFilterSuggestionProvider({
    columns: schemaColumns,
    namedFilters,
    table,
  });

  useEffect(() => {
    const connect = async () => {
      const authToken = (await vuuAuthenticate("steve", "xyz")) as string;
      connectToServer("127.0.0.1:8090/websocket", authToken);
    };
    connect();
  }, []);

  const handleSubmitFilter = useCallback(
    (
      newFilter: Filter | undefined,
      filterQuery: string,
      mode: "and" | "or" | "replace" = "replace",
      filterName?: string
    ) => {
      let newFilterState: FilterState;
      if (newFilter && mode === "and") {
        const fullFilter = addFilter(filterState.filter, newFilter) as Filter;
        newFilterState = {
          filter: fullFilter,
          filterQuery: filterAsQuery(fullFilter),
          filterName,
        };
      } else {
        newFilterState = {
          filter: newFilter,
          filterQuery,
          filterName,
        };
      }

      setFilterState(newFilterState);
      if (filterName && newFilterState.filter) {
        namedFilters.set(filterName, newFilterState.filterQuery);
      }
    },
    [filterState.filter, namedFilters]
  );

  return (
    <>
      <FilterInput
        existingFilter={filterState.filter}
        namedFilters={namedFilters}
        onSubmitFilter={handleSubmitFilter}
        suggestionProvider={suggestionProvider}
      />
      <br />
      <br />
      <div>{filterState.filterQuery}</div>
      <br />
      <div>{filterState.filterName}</div>
      <br />
      <br />
      <JsonTable source={filterState.filter} height={400} />
    </>
  );
};
DefaultFilterInput.displaySequence = displaySequence++;

export const FilterInputTabs = () => {
  type FilterState = {
    filter: Filter | undefined;
    filterQuery: string;
    filterName?: string;
  };

  // prettier-ignore
  const saveOptions = useMemo<FilterSaveOptions>(
    () => ({ allowReplace: true, allowSaveAsTab: true,}), []
  );

  const namedFilters = useMemo(() => new Map<string, string>(), []);
  const [filterState, setFilterState] = useState<FilterState>({
    filter: undefined,
    filterQuery: "",
  });
  const suggestionProvider = useFilterSuggestionProvider({
    columns: schemaColumns,
    namedFilters,
    saveOptions,
    table,
  });

  useEffect(() => {
    const connect = async () => {
      const authToken = (await vuuAuthenticate("steve", "xyz")) as string;
      connectToServer("127.0.0.1:8090/websocket", authToken);
    };
    connect();
  }, []);

  const handleSubmitFilter = useCallback(
    (
      newFilter: Filter | undefined,
      filterQuery: string,
      mode: FilterSubmissionMode = "replace",
      filterName?: string
    ) => {
      if (mode === "tab") {
        alert("create a new tab");
      } else {
        let newFilterState: FilterState;
        if (newFilter && mode === "and") {
          const fullFilter = addFilter(filterState.filter, newFilter) as Filter;
          newFilterState = {
            filter: fullFilter,
            filterQuery: filterAsQuery(fullFilter),
            filterName,
          };
        } else {
          newFilterState = {
            filter: newFilter,
            filterQuery,
            filterName,
          };
        }
        setFilterState(newFilterState);
        if (filterName && newFilterState.filter) {
          namedFilters.set(filterName, newFilterState.filterQuery);
        }
      }
    },
    [filterState.filter, namedFilters]
  );

  return (
    <>
      <FilterInput
        existingFilter={filterState.filter}
        namedFilters={namedFilters}
        onSubmitFilter={handleSubmitFilter}
        suggestionProvider={suggestionProvider}
      />
      <br />
      <br />
      <div>{filterState.filterQuery}</div>
      <br />
      <div>{filterState.filterName}</div>
      <br />
      <br />
      <JsonTable source={filterState.filter} height={400} />
    </>
  );
};
FilterInputTabs.displaySequence = displaySequence++;

export const FilterInputWithToolbar = () => {
  const [filter, setFilter] = useState<Filter>();
  const [filterQuery, setFilterQuery] = useState<string>("");
  const [filterName, setFilterName] = useState<string>("");
  const suggestionProvider = useFilterSuggestionProvider({
    columns: schemaColumns,
    table,
  });

  useEffect(() => {
    const connect = async () => {
      const authToken = (await vuuAuthenticate("steve", "xyz")) as string;
      connectToServer("127.0.0.1:8090/websocket", authToken);
    };
    connect();
  }, []);

  const handleSubmitFilter = useCallback(
    (
      filter: Filter | undefined,
      filterQuery: string,
      filterName?: string,
      mode = "add"
    ) => {
      console.log(`setFilter ${JSON.stringify(filter)}`);
      setFilter((existingFilter) => updateFilter(existingFilter, filter, mode));
      setFilterQuery(filterQuery);
      setFilterName(filterName ?? "");
    },
    []
  );

  return (
    <>
      <FilterInput
        existingFilter={filter}
        onSubmitFilter={handleSubmitFilter}
        suggestionProvider={suggestionProvider}
      />
      <br />
      <FilterToolbar
        id="toolbar-default"
        filter={filter}
        suggestionProvider={suggestionProvider}
      />

      <br />
      <div>{filterQuery}</div>
      <br />
      <div>{filterName}</div>
      <br />
      <br />
    </>
  );
};
FilterInputWithToolbar.displaySequence = displaySequence++;
