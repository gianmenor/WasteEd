// Frontend Integration Guide for TanStack React Table
// Optimized API endpoints for React frontend with TanStack Table

const frontendExamples = {
  
  // Example 1: Basic table data fetch
  basicTableFetch: {
    endpoint: 'GET /api/waste/records',
    url: '/api/waste/records?page=1&pageSize=10&sortBy=date&sortOrder=desc',
    description: 'Fetch first 10 records, sorted by date (newest first)'
  },

  // Example 2: Advanced filtering and search
  advancedQuery: {
    endpoint: 'GET /api/waste/records',
    url: '/api/waste/records?page=2&pageSize=25&search=2025-09&sortBy=total&sortOrder=desc&dateFrom=2025-09-01&dateTo=2025-09-30&minTotal=50',
    description: 'Page 2, 25 items, search "2025-09", sort by total desc, September 2025, min total 50'
  },

  // Example 3: Successful response structure
  apiResponse: {
    success: true,
    message: "Retrieved 10 waste record(s)",
    data: [
      {
        id: 21,
        date: "2025-09-30",
        recyclable: 25,
        biodegradable: 18,
        nonBiodegradable: 12,
        total: 55,
        createdAt: "2025-09-30T15:30:45.123Z",
        updatedAt: "2025-09-30T15:30:45.123Z"
      }
      // ... more records
    ],
    meta: {
      pagination: {
        page: 1,
        pageSize: 10,
        total: 156,
        totalPages: 16,
        hasNextPage: true,
        hasPreviousPage: false,
        startIndex: 1,
        endIndex: 10
      },
      statistics: {
        totalRecyclable: 250,
        totalBiodegradable: 180,
        totalNonBiodegradable: 120,
        grandTotal: 550,
        maxDaily: 75,
        minDaily: 25,
        averagePerDay: 55,
        recordCount: 10
      },
      filters: {
        search: null,
        dateFrom: null,
        dateTo: null,
        sortBy: "date",
        sortOrder: "desc",
        appliedFilters: []
      }
    }
  }
};

// React TanStack Table Integration Example
const reactTableExample = `
import React, { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { useQuery } from '@tanstack/react-query';

// API service for waste records
const wasteAPI = {
  getRecords: async (params) => {
    const searchParams = new URLSearchParams();
    
    // Add all parameters to the query string
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, value);
      }
    });
    
    const response = await fetch(\`/api/waste/records?\${searchParams}\`);
    if (!response.ok) throw new Error('Failed to fetch records');
    return response.json();
  }
};

const columnHelper = createColumnHelper();

const WasteRecordsTable = () => {
  // Table state
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [sorting, setSorting] = useState([{ id: 'date', desc: true }]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState([]);
  
  // Build API parameters
  const apiParams = useMemo(() => {
    const params = {
      page: pagination.pageIndex + 1, // API uses 1-based pagination
      pageSize: pagination.pageSize,
      search: globalFilter || '',
    };
    
    // Add sorting
    if (sorting.length > 0) {
      params.sortBy = sorting[0].id;
      params.sortOrder = sorting[0].desc ? 'desc' : 'asc';
    }
    
    // Add column filters
    columnFilters.forEach(filter => {
      if (filter.id === 'dateRange' && filter.value) {
        if (filter.value.from) params.dateFrom = filter.value.from;
        if (filter.value.to) params.dateTo = filter.value.to;
      } else if (filter.id === 'totalRange' && filter.value) {
        if (filter.value.min) params.minTotal = filter.value.min;
        if (filter.value.max) params.maxTotal = filter.value.max;
      } else if (filter.value) {
        params[filter.id] = filter.value;
      }
    });
    
    return params;
  }, [pagination, sorting, globalFilter, columnFilters]);
  
  // Fetch data using React Query
  const { data, isLoading, error } = useQuery({
    queryKey: ['wasteRecords', apiParams],
    queryFn: () => wasteAPI.getRecords(apiParams),
    keepPreviousData: true,
  });
  
  // Define columns
  const columns = useMemo(() => [
    columnHelper.accessor('date', {
      header: 'Date',
      cell: info => new Date(info.getValue()).toLocaleDateString(),
      enableSorting: true,
    }),
    columnHelper.accessor('recyclable', {
      header: 'Recyclable',
      cell: info => \`\${info.getValue()} kg\`,
      enableSorting: true,
    }),
    columnHelper.accessor('biodegradable', {
      header: 'Biodegradable',
      cell: info => \`\${info.getValue()} kg\`,
      enableSorting: true,
    }),
    columnHelper.accessor('nonBiodegradable', {
      header: 'Non-Biodegradable',
      cell: info => \`\${info.getValue()} kg\`,
      enableSorting: true,
    }),
    columnHelper.accessor('total', {
      header: 'Total',
      cell: info => \`\${info.getValue()} kg\`,
      enableSorting: true,
    }),
  ], []);
  
  // Configure table
  const table = useReactTable({
    data: data?.data || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    pageCount: data?.meta?.pagination?.totalPages || 0,
    state: {
      pagination,
      sorting,
      globalFilter,
      columnFilters,
    },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
  });
  
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <div className="waste-records-table">
      {/* Global Search */}
      <div className="table-controls">
        <input
          value={globalFilter ?? ''}
          onChange={e => setGlobalFilter(e.target.value)}
          placeholder="Search all records..."
          className="global-search"
        />
        
        {/* Statistics Display */}
        {data?.meta?.statistics && (
          <div className="statistics">
            <span>Total Records: {data.meta.pagination.total}</span>
            <span>Total Waste: {data.meta.statistics.grandTotal} kg</span>
            <span>Avg/Day: {data.meta.statistics.averagePerDay} kg</span>
          </div>
        )}
      </div>
      
      {/* Table */}
      <table className="data-table">
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <th key={header.id}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getCanSort() && (
                    <button
                      onClick={header.column.getToggleSortingHandler()}
                      className="sort-button"
                    >
                      {{
                        asc: ' 🔼',
                        desc: ' 🔽',
                      }[header.column.getIsSorted()] ?? ' ↕️'}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {isLoading ? (
            <tr><td colSpan={columns.length}>Loading...</td></tr>
          ) : (
            table.getRowModel().rows.map(row => (
              <tr key={row.id}>
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      
      {/* Pagination */}
      <div className="pagination">
        <button
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
        >
          {'<<'}
        </button>
        <button
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          {'<'}
        </button>
        <span>
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </span>
        <button
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          {'>'}
        </button>
        <button
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          disabled={!table.getCanNextPage()}
        >
          {'>>'}
        </button>
        
        <select
          value={table.getState().pagination.pageSize}
          onChange={e => table.setPageSize(Number(e.target.value))}
        >
          {[10, 20, 30, 40, 50].map(pageSize => (
            <option key={pageSize} value={pageSize}>
              Show {pageSize}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default WasteRecordsTable;
`;

// Query Parameters Reference
const queryParamsReference = {
  pagination: {
    page: { type: 'number', default: 1, description: 'Page number (1-based)' },
    pageSize: { type: 'number', default: 10, max: 100, description: 'Items per page' }
  },
  search: {
    search: { type: 'string', description: 'Global search across all fields' }
  },
  sorting: {
    sortBy: { 
      type: 'string', 
      options: ['date', 'recyclable', 'biodegradable', 'nonBiodegradable', 'total', 'createdAt', 'updatedAt'],
      default: 'date',
      description: 'Field to sort by'
    },
    sortOrder: { type: 'string', options: ['asc', 'desc'], default: 'desc', description: 'Sort direction' }
  },
  dateFilters: {
    dateFrom: { type: 'string', format: 'YYYY-MM-DD', description: 'Filter from date (inclusive)' },
    dateTo: { type: 'string', format: 'YYYY-MM-DD', description: 'Filter to date (inclusive)' }
  },
  numericFilters: {
    minTotal: { type: 'number', description: 'Minimum daily total filter' },
    maxTotal: { type: 'number', description: 'Maximum daily total filter' },
    minRecyclable: { type: 'number', description: 'Minimum recyclable amount' },
    maxRecyclable: { type: 'number', description: 'Maximum recyclable amount' },
    minBiodegradable: { type: 'number', description: 'Minimum biodegradable amount' },
    maxBiodegradable: { type: 'number', description: 'Maximum biodegradable amount' },
    minNonBiodegradable: { type: 'number', description: 'Minimum non-biodegradable amount' },
    maxNonBiodegradable: { type: 'number', description: 'Maximum non-biodegradable amount' }
  }
};

console.log('🚀 Frontend Integration Guide for TanStack React Table');
console.log('=' .repeat(70));
console.log('');
console.log('📡 API Endpoint: GET /api/waste/records');
console.log('');
console.log('🎯 Example Queries:');
console.log('Basic:', frontendExamples.basicTableFetch.url);
console.log('Advanced:', frontendExamples.advancedQuery.url);
console.log('');
console.log('📊 Response Structure:');
console.log(JSON.stringify(frontendExamples.apiResponse, null, 2));
console.log('');
console.log('⚛️  Complete React TanStack Table Implementation:');
console.log(reactTableExample);
console.log('');
console.log('📋 Query Parameters Reference:');
console.log(JSON.stringify(queryParamsReference, null, 2));
console.log('');
console.log('✨ Key Features:');
console.log('✅ Server-side pagination (better performance)');
console.log('✅ Server-side sorting (all fields supported)');
console.log('✅ Global search across all fields');
console.log('✅ Advanced filtering (date ranges, numeric ranges)');
console.log('✅ Real-time statistics');
console.log('✅ TanStack React Table optimized');
console.log('✅ React Query integration ready');
console.log('');
console.log('📦 Required Dependencies:');
console.log('npm install @tanstack/react-table @tanstack/react-query');

export default frontendExamples;