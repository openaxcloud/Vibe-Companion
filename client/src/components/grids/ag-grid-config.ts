/**
 * AG Grid Configuration
 * Centralized configuration for all AG Grid instances
 * Phase 2 - Agent Activity Dashboard
 */

import type { GridOptions, ColDef } from 'ag-grid-community';

export const defaultGridOptions: GridOptions = {
  pagination: true,
  paginationPageSize: 25,
  paginationPageSizeSelector: [10, 25, 50, 100],
  animateRows: true,
  rowSelection: 'multiple',
  suppressRowClickSelection: true,
  enableCellTextSelection: true,
  ensureDomOrder: true,
  domLayout: 'autoHeight',
  suppressColumnVirtualisation: false,
  suppressRowVirtualisation: false,
  rowBuffer: 10,
  debounceVerticalScrollbar: true,
  defaultColDef: {
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 80,
    flex: 1,
  },
  overlayLoadingTemplate: '<div class="ag-overlay-loading-center">Loading...</div>',
  overlayNoRowsTemplate: '<div class="ag-overlay-no-rows-center">No data available</div>',
};

export const sessionGridColDefs: ColDef[] = [
  {
    headerName: 'Session ID',
    field: 'id',
    width: 120,
    pinned: 'left',
    filter: 'agTextColumnFilter',
    cellRenderer: 'idCellRenderer',
  },
  {
    headerName: 'User',
    field: 'userName',
    width: 150,
    filter: 'agTextColumnFilter',
  },
  {
    headerName: 'Project',
    field: 'projectName',
    width: 180,
    filter: 'agTextColumnFilter',
  },
  {
    headerName: 'Model',
    field: 'model',
    width: 150,
    filter: 'agSetColumnFilter',
  },
  {
    headerName: 'Status',
    field: 'status',
    width: 100,
    filter: 'agSetColumnFilter',
    cellRenderer: 'statusCellRenderer',
  },
  {
    headerName: 'Started',
    field: 'startedAt',
    width: 160,
    filter: 'agDateColumnFilter',
    valueFormatter: (params) => {
      if (!params.value) return '';
      return new Date(params.value).toLocaleString();
    },
    sort: 'desc',
  },
  {
    headerName: 'Duration',
    field: 'duration',
    width: 100,
    filter: 'agNumberColumnFilter',
    valueFormatter: (params) => {
      if (!params.value) return '-';
      const ms = params.value;
      if (ms < 1000) return `${ms}ms`;
      if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
      if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
      return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
    },
  },
  {
    headerName: 'Tokens',
    field: 'totalTokensUsed',
    width: 100,
    filter: 'agNumberColumnFilter',
    valueFormatter: (params) => {
      if (!params.value) return '0';
      return params.value.toLocaleString();
    },
  },
  {
    headerName: 'Actions',
    field: 'actionsCount',
    width: 90,
    filter: 'agNumberColumnFilter',
  },
  {
    headerName: 'Files',
    field: 'filesModified',
    width: 80,
    filter: 'agNumberColumnFilter',
    valueGetter: (params) => {
      const data = params.data;
      if (!data) return 0;
      return (data.filesCreated || 0) + (data.filesModified || 0);
    },
  },
  {
    headerName: 'Errors',
    field: 'errorsCount',
    width: 80,
    filter: 'agNumberColumnFilter',
    cellRenderer: 'errorCellRenderer',
  },
  {
    headerName: 'Mode',
    field: 'autonomousMode',
    width: 100,
    filter: 'agSetColumnFilter',
    valueFormatter: (params) => params.value ? 'Autonomous' : 'Interactive',
  },
];

export const actionGridColDefs: ColDef[] = [
  {
    headerName: 'Action',
    field: 'actionLabel',
    width: 150,
    filter: 'agTextColumnFilter',
    cellRenderer: 'actionTypeCellRenderer',
  },
  {
    headerName: 'Target',
    field: 'target',
    width: 250,
    filter: 'agTextColumnFilter',
    cellRenderer: 'targetCellRenderer',
  },
  {
    headerName: 'Status',
    field: 'status',
    width: 100,
    filter: 'agSetColumnFilter',
    cellRenderer: 'statusCellRenderer',
  },
  {
    headerName: 'Risk',
    field: 'riskLevel',
    width: 80,
    filter: 'agSetColumnFilter',
    cellRenderer: 'riskCellRenderer',
  },
  {
    headerName: 'Time',
    field: 'executedAt',
    width: 160,
    filter: 'agDateColumnFilter',
    valueFormatter: (params) => {
      if (!params.value) return '';
      return new Date(params.value).toLocaleString();
    },
    sort: 'desc',
  },
  {
    headerName: 'Duration',
    field: 'duration',
    width: 90,
    filter: 'agNumberColumnFilter',
    valueFormatter: (params) => {
      if (!params.value) return '-';
      return `${params.value}ms`;
    },
  },
  {
    headerName: 'Approved',
    field: 'autoApproved',
    width: 90,
    filter: 'agSetColumnFilter',
    valueFormatter: (params) => params.value ? 'Auto' : 'Manual',
  },
  {
    headerName: 'Rollback',
    field: 'rollbackAvailable',
    width: 90,
    filter: 'agSetColumnFilter',
    cellRenderer: 'rollbackCellRenderer',
  },
];

export const fileOperationGridColDefs: ColDef[] = [
  {
    headerName: 'Operation',
    field: 'operationType',
    width: 100,
    filter: 'agSetColumnFilter',
    cellRenderer: 'operationTypeCellRenderer',
  },
  {
    headerName: 'File',
    field: 'fileName',
    width: 200,
    filter: 'agTextColumnFilter',
  },
  {
    headerName: 'Path',
    field: 'filePath',
    width: 300,
    filter: 'agTextColumnFilter',
    cellRenderer: 'pathCellRenderer',
  },
  {
    headerName: 'Language',
    field: 'language',
    width: 120,
    filter: 'agSetColumnFilter',
  },
  {
    headerName: 'Lines +',
    field: 'linesAdded',
    width: 80,
    filter: 'agNumberColumnFilter',
    cellStyle: { color: 'green' },
  },
  {
    headerName: 'Lines -',
    field: 'linesRemoved',
    width: 80,
    filter: 'agNumberColumnFilter',
    cellStyle: { color: 'red' },
  },
  {
    headerName: 'Size',
    field: 'fileSize',
    width: 80,
    filter: 'agNumberColumnFilter',
    valueFormatter: (params) => {
      if (!params.value) return '-';
      const bytes = params.value;
      if (bytes < 1024) return `${bytes}B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    },
  },
  {
    headerName: 'Time',
    field: 'timestamp',
    width: 160,
    filter: 'agDateColumnFilter',
    valueFormatter: (params) => {
      if (!params.value) return '';
      return new Date(params.value).toLocaleString();
    },
    sort: 'desc',
  },
  {
    headerName: 'Rollback',
    field: 'rollbackAvailable',
    width: 90,
    filter: 'agSetColumnFilter',
    cellRenderer: 'rollbackCellRenderer',
  },
];

export const conversationGridColDefs: ColDef[] = [
  {
    headerName: 'Role',
    field: 'role',
    width: 100,
    filter: 'agSetColumnFilter',
    cellRenderer: 'roleCellRenderer',
  },
  {
    headerName: 'Content',
    field: 'contentPreview',
    width: 400,
    filter: 'agTextColumnFilter',
    cellRenderer: 'contentCellRenderer',
  },
  {
    headerName: 'Model',
    field: 'model',
    width: 150,
    filter: 'agSetColumnFilter',
  },
  {
    headerName: 'Tokens',
    field: 'tokensUsed',
    width: 80,
    filter: 'agNumberColumnFilter',
    valueFormatter: (params) => {
      if (!params.value) return '-';
      return params.value.toLocaleString();
    },
  },
  {
    headerName: 'Cost',
    field: 'cost',
    width: 80,
    filter: 'agNumberColumnFilter',
    valueFormatter: (params) => {
      if (!params.value) return '-';
      return `$${params.value.toFixed(4)}`;
    },
  },
  {
    headerName: 'Latency',
    field: 'latency',
    width: 80,
    filter: 'agNumberColumnFilter',
    valueFormatter: (params) => {
      if (!params.value) return '-';
      return `${params.value}ms`;
    },
  },
  {
    headerName: 'Tools',
    field: 'toolCallsCount',
    width: 70,
    filter: 'agNumberColumnFilter',
    cellRenderer: 'toolCallsCellRenderer',
  },
  {
    headerName: 'Thinking',
    field: 'hasThinking',
    width: 80,
    filter: 'agSetColumnFilter',
    cellRenderer: 'thinkingCellRenderer',
  },
  {
    headerName: 'Time',
    field: 'timestamp',
    width: 160,
    filter: 'agDateColumnFilter',
    valueFormatter: (params) => {
      if (!params.value) return '';
      return new Date(params.value).toLocaleString();
    },
    sort: 'desc',
  },
];
