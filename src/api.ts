/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { type DriveFile, type GmailThread } from './types';

// Helper to construct Google API headers
const getHeaders = (accessToken: string) => {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
};

/**
 * Searches user files in Google Drive. Filtered by typical files related to schemas/queries
 */
export const searchDriveFiles = async (
  accessToken: string,
  searchQuery: string = ''
): Promise<DriveFile[]> => {
  try {
    const qParts = [];
    
    // Search within applicable text, code or CSV representations
    if (searchQuery) {
      qParts.push(`name contains '${searchQuery.replace(/'/g, "\\'")}'`);
    } else {
      qParts.push(`(mimeType = 'text/plain' or mimeType = 'text/x-sql' or mimeType = 'application/json' or mimeType = 'text/csv' or name contains 'sql' or name contains 'schema' or name contains 'query' or name contains 'table')`);
    }

    const q = qParts.join(' and ');
    const url = `https://www.googleapis.com/drive/v3/files?pageSize=40&fields=files(id,name,mimeType,size,modifiedTime)&q=${encodeURIComponent(
      q
    )}&orderBy=modifiedTime desc`;

    const res = await fetch(url, {
      headers: getHeaders(accessToken),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Drive Search Error: ${errText || res.statusText}`);
    }

    const data = await res.json();
    return data.files || [];
  } catch (error) {
    console.error('Error fetching drive files:', error);
    throw error;
  }
};

/**
 * Fetches contents of a selected Google Drive file
 */
export const fetchDriveFileContent = async (
  accessToken: string,
  fileId: string
): Promise<string> => {
  try {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Drive Download Error: ${res.statusText}`);
    }

    return await res.text();
  } catch (error) {
    console.error('Error downloading drive file content:', error);
    throw error;
  }
};

/**
 * Fetches recent database-related threads from user's Gmail
 */
export const fetchGmailThreads = async (
  accessToken: string,
  searchQuery: string = 'sql OR query OR database'
): Promise<GmailThread[]> => {
  try {
    const listUrl = `https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=${encodeURIComponent(
      searchQuery
    )}`;
    const listRes = await fetch(listUrl, { headers: getHeaders(accessToken) });

    if (!listRes.ok) {
      throw new Error(`Gmail List Error: ${listRes.statusText}`);
    }

    const listData = await listRes.json();
    if (!listData.messages || listData.messages.length === 0) {
      return [];
    }

    // Load detailed headers for each message
    const threads: GmailThread[] = [];
    for (const msg of listData.messages) {
      try {
        const detailUrl = `https://www.googleapis.com/gmail/v1/users/me/messages/${msg.id}`;
        const detailRes = await fetch(detailUrl, { headers: getHeaders(accessToken) });
        if (!detailRes.ok) continue;

        const detailData = await detailRes.json();
        const headers: any[] = detailData.payload.headers || [];
        const subject = headers.find((h) => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
        const from = headers.find((h) => h.name.toLowerCase() === 'from')?.value || 'Unknown sender';
        const date = headers.find((h) => h.name.toLowerCase() === 'date')?.value || '';

        threads.push({
          id: msg.id,
          subject,
          from,
          date,
          snippet: detailData.snippet || '',
        });
      } catch (err) {
        console.error(`Error loading email detail for ${msg.id}:`, err);
      }
    }

    return threads;
  } catch (error) {
    console.error('Error fetching gmail logs:', error);
    throw error;
  }
};

/**
 * Encodes the e-mail headers and body in base64url MIME standard for Gmail API send
 */
const makeEmailRaw = (to: string, subject: string, htmlBody: string): string => {
  const boundary = 'b_boundary_1234567890';
  const mailLines = [
    `To: ${to}`,
    'Content-Type: multipart/alternative; boundary=' + boundary,
    'MIME-Version: 1.0',
    `Subject: ${subject}`,
    '',
    '--' + boundary,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    'Content-Transfer-Encoding: base64',
    '',
    btoa(unescape(encodeURIComponent(htmlBody))),
    '',
    '--' + boundary + '--',
  ];

  const fullEmailText = mailLines.join('\r\n');
  return btoa(unescape(encodeURIComponent(fullEmailText)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

/**
 * Sends a constructed SQL layout email to target recipients via Gmail API
 */
export const sendGmailMessage = async (
  accessToken: string,
  to: string,
  subject: string,
  htmlBody: string
): Promise<boolean> => {
  try {
    const rawContent = makeEmailRaw(to, subject, htmlBody);
    const url = 'https://www.googleapis.com/gmail/v1/users/me/messages/send';
    const res = await fetch(url, {
      method: 'POST',
      headers: getHeaders(accessToken),
      body: JSON.stringify({
        raw: rawContent,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gmail Send Error: ${errText || res.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};
