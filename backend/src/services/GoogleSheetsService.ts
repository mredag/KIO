import { google, sheets_v4 } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

/**
 * GoogleSheetsService handles all interactions with Google Sheets API v4
 * Manages authentication, connection testing, and data synchronization
 */
export class GoogleSheetsService {
  private auth: GoogleAuth | null = null;
  private sheets: sheets_v4.Sheets | null = null;
  private isInitialized = false;

  /**
   * Initialize the Google Sheets API client with credentials
   * @param credentials - JSON string containing service account credentials
   */
  async initialize(credentials: string): Promise<void> {
    try {
      // Parse credentials JSON
      const credentialsObj = JSON.parse(credentials);

      // Create auth client from service account credentials
      this.auth = new google.auth.GoogleAuth({
        credentials: credentialsObj,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      // Create sheets API client
      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      this.isInitialized = true;
    } catch (error) {
      this.isInitialized = false;
      throw new Error(
        `Failed to initialize Google Sheets service: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Test connection to a specific Google Sheet
   * Attempts to read the sheet to verify access
   * @param sheetId - The Google Sheet ID
   * @param sheetName - The name of the sheet/tab within the spreadsheet
   * @returns true if connection successful, false otherwise
   */
  async testConnection(sheetId: string, sheetName: string): Promise<boolean> {
    if (!this.isInitialized || !this.sheets) {
      throw new Error('Google Sheets service not initialized');
    }

    try {
      // Attempt to read the sheet metadata to verify access
      await this.sheets.spreadsheets.get({
        spreadsheetId: sheetId,
      });

      // Verify the specific sheet/tab exists
      await this.sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${sheetName}!A1`,
      });

      return true;
    } catch (error) {
      console.error('Google Sheets connection test failed:', error);
      return false;
    }
  }

  /**
   * Append a row of data to the specified Google Sheet
   * @param sheetId - The Google Sheet ID
   * @param sheetName - The name of the sheet/tab within the spreadsheet
   * @param values - Array of values to append as a new row
   */
  async appendRow(
    sheetId: string,
    sheetName: string,
    values: any[]
  ): Promise<void> {
    if (!this.isInitialized || !this.sheets) {
      throw new Error('Google Sheets service not initialized');
    }

    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `${sheetName}!A:Z`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [values],
        },
      });
    } catch (error) {
      throw new Error(
        `Failed to append row to Google Sheets: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if the service is initialized and ready to use
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Reset the service (useful for credential updates)
   */
  reset(): void {
    this.auth = null;
    this.sheets = null;
    this.isInitialized = false;
  }
}
