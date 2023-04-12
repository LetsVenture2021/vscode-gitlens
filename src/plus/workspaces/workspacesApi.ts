import type { Container } from '../../container';
import { Logger } from '../../system/logger';
import type { ServerConnection } from '../subscription/serverConnection';
import type {
	WorkspacesResponse,
} from './models';


export class WorkspacesApi {
	constructor(private readonly container: Container, private readonly server: ServerConnection) {}

	private async getAccessToken() {
		// TODO: should probably get scopes from somewhere
		const sessions = await this.container.subscriptionAuthentication.getSessions(['gitlens']);
		if (!sessions.length) {
			return;
		}

		const session = sessions[0];
		return session.accessToken;
	}

	// TODO@ramint: We have a pagedresponse model available in case it helps here. Takes care of cursor internally
	// TODO@ramint: Move to a model where we split the calls. Get the workspaces, then gets repos per workspace.
    // Make the data return a promise for the repos. Should be async so we're set up for dynamic processing.
	async getWorkspacesWithRepos(options?: { cursor?: string; page?: number }): Promise<WorkspacesResponse | undefined> {
		const accessToken = await this.getAccessToken();
		if (accessToken == null) {
			return;
		}

		let queryparams = '(first: 100';
		if (options?.cursor) {
			queryparams += `, after: "${options.cursor}"`;
		} else if (options?.page) {
			queryparams += `, page: ${options.page}`;
		}
		queryparams += ')';

		const rsp = await this.server.fetchGraphql(
			{
				query: `
                    query getWorkspaces {
                        projects ${queryparams} {
                            total_count
                            page_info {
                                end_cursor
                                has_next_page
                            }
                            nodes {
                                id
                                name
                                provider
                                provider_data {
                                    repositories (first: 100) {
                                        total_count
                                        page_info {
                                            start_cursor
                                            has_next_page
                                        }
                                        nodes {
                                            id
                                            name
                                            repository_id
                                            provider
                                            url
                                        }
                                    }
                                }
                            }
                        }
                    }
				`,
			},
			accessToken,
		);

		if (!rsp.ok) {
			Logger.error(undefined, `Getting workspaces failed: (${rsp.status}) ${rsp.statusText}`);
			throw new Error(rsp.statusText);
		}

		const json: WorkspacesResponse | undefined = await rsp.json() as WorkspacesResponse | undefined;

		return json;
	}

	async createWorkspace(): Promise<void> {}

	async deleteWorkspace(): Promise<void> {}

	async addReposToWorkspace(): Promise<void> {}

	async removeReposFromWorkspace(): Promise<void> {}
}
