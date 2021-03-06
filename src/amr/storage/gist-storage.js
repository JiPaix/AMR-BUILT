import Axios from 'axios'
import Storage from './model-storage'
import { ThrottleError } from './error/ToManyRequests';

export default class GistStorage extends Storage {

  constructor(config) {
    super(false)
    this.gistSyncGitID = config.gistSyncGitID
    this.gistSyncSecret = config.gistSyncSecret
    this.axios = this.initAxios()
    this.requests = 0
  }

  initAxios() {
    return Axios.create({
      baseURL: 'https://api.github.com/',
      headers: {
        'Authorization': `Bearer ${this.gistSyncSecret}`,
        'Cache-Control': 'no-cache'
      }
    })
  }

  reconfig(key, value) {
    this[key] = value
    this.axios = this.initAxios()
  }

  /**
   * 
   * @param {String} method 
   * @param {String} path 
   */
  async ax(method, path, data) {
    let results;
    await this.wait()
    if(method = 'get') results = await this.axios.get(path).catch(this.handleSyncError)
    if(method = 'patch') results = await this.axios.patch(path, data).catch(this.handleSyncError)
    return results
  }

  async getAll() {
    if(!this.gistSyncGitID || !this.gistSyncSecret) throw new Error('Missing credentials. Skipping update')
    if(!this.gistSyncSecret.startsWith('ghp_')) throw new Error('Missing PAT. Skipping update')
    if(this.gistSyncSecret.length < 2) throw new Error('Missing ID. Skipping update')
    const request = await this.ax('get', `gists/${this.gistSyncGitID}?cache=${Date.now()}`).catch(this.handleSyncError)
    const amr = request.data.files['amr.json']
    if(amr) {
      if(amr.truncated) {
        const content = await this.ax('get', amr.raw_url).catch(this.handleSyncError)
        return content.data
      } else {
        return JSON.parse(amr.content)
      }
    } else {
      await this.init()
      return this.getAll()
    }
  }

  async init() {
    await this.wait()
    const request = await this.ax('patch', `gists/${this.gistSyncGitID}`, this.getFileStruct('[]')).catch(this.handleSyncError)
    return JSON.parse(request.data.files['amr.json'].content)
  }

  async saveAll(content) {
    await this.wait()
    return this.ax('patch', `gists/${this.gistSyncGitID}`, this.getFileStruct(JSON.stringify(content))).catch(this.handleSyncError)
  }

  handleSyncError(e) {
    if(e.response.headers['x-ratelimit-remaining'] === "0") {
      // Set delay according to API response
      const timestamp = parseInt(e.response.headers['x-ratelimit-reset']) * 1000
      throw new ThrottleError(e.response.data.message, new Date(timestamp))
    }
    throw new Error(e.response.data.message)
  }

  async delete(key, value) {
    const data = await this.getAll()
    const updates = data.map(manga => manga.key === key ? value : manga)
    await this.wait()
    this.ax('patch', `gists/${this.gistSyncGitID}`, this.getFileStruct(JSON.stringify(updates)))
      .catch(e=> {
        if(e.response.headers['x-ratelimit-remaining'] === "0") {
          const timestamp = parseInt(e.response.headers['x-ratelimit-reset']) * 1000
          setTimeout(() => {
            this.delete(key, value)
          }, new Date(timestamp).getTime() - Date.now());
          throw new ThrottleError(e.response.data.message, new Date(timestamp))
        }
        throw new Error(e.response.data.message)
      })
  }

  getFileStruct(content) {
    return { files: { 'amr.json' : { content: content } } }
  }
}
