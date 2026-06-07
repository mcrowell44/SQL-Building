/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Column {
  name: string;
  type: string; // e.g. INT, VARCHAR, DECIMAL, BOOLEAN, TIMESTAMP
  primaryKey: boolean;
  notNull: boolean;
  foreignKey?: {
    table: string;
    column: string;
  };
}

export interface Table {
  name: string;
  columns: Column[];
}

export interface JoinConfig {
  id: string;
  type: 'INNER JOIN' | 'LEFT JOIN' | 'RIGHT JOIN';
  leftTable: string;
  leftColumn: string;
  rightTable: string;
  rightColumn: string;
}

export interface FilterConfig {
  id: string;
  table: string;
  column: string;
  operator: '=' | '!=' | '>' | '<' | 'LIKE' | 'IN' | 'IS NULL';
  value: string;
  logic: 'AND' | 'OR';
}

export interface SelectField {
  id: string;
  table: string;
  column: string;
  alias?: string;
  aggregate?: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX';
}

export interface OrderByConfig {
  table: string;
  column: string;
  direction: 'ASC' | 'DESC';
}

export interface VisualQueryState {
  fromTable: string;
  fields: SelectField[];
  joins: JoinConfig[];
  filters: FilterConfig[];
  groupBy: string[];
  orderBy: OrderByConfig[];
  limit: number;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
}

export interface GmailThread {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}
