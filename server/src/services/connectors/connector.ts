export interface DestinationConnector {
  /**
   * Initializes the connection to the destination system.
   */
  connect(): Promise<void>;

  /**
   * Writes a batch of transformed rows into the destination.
   * @param batch The batch of transformed row objects
   */
  writeBatch(batch: any[]): Promise<void>;

  /**
   * Closes the connection and performs any final flush operations.
   */
  disconnect(): Promise<void>;
}
