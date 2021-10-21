import Manga from "../../amr/manga";
import { Mangadex } from "../../background/misc/mangadex-v5-integration"

let mangadex;

const state = {
  imports: [
    {
      mirror: 'mangadex',
      value: []
    }
  ],
  export: [],
  texts: [
    {
      mirror: 'mangadex',
      export: undefined,
      exportProgress: undefined,
      exportTotal: undefined,
      exportFollows: undefined,
      exportFollowsProgress: undefined,
      exportFollowsTotal: undefined,
      import: 'options_mangadex_loading_list',
      importProgress: undefined,
      importTotal: undefined
    }
  ],
  loadings: [
    {
      mirror: 'mangadex',
      credential: false,
      export: false,
      exportFollows: false,
      import: false,
      importLang: '',
    }
  ],
  credentials: [
    {
      mirror: 'mangadex',
      validity: false
    }
  ],
  misc: [
    {
      mirror :'mangadex',
      exportDone: false,
      exportFollowsDone: false,
    }
  ]
}

const getters = {
  mangadex : {
    allOptions: (state, getters, rootState) => {
      return Object.keys(rootState.options)
          .filter(opt=>opt.startsWith('mangadex'))
          .reduce((obj, key) => {
              obj[key] = rootState.options[key]
              return obj
          }, {})
    },
    options : {
      enabled: (state, getters, rootState) => getters.mangadex.allOptions.mangadexIntegrationEnable == 1,
      valid: (state, getters, rootState) => getters.mangadex.allOptions.mangadexvalidCredentials == 1,
      exportToList: (state, getters, rootState) => getters.mangadex.allOptions.mangadexExportToList == 1,
      exportToFollows: (state, getters, rootState) => getters.mangadex.allOptions.mangadexExportToFollows == 1,
      markAsRead: (state, getters, rootState) => getters.mangadex.allOptions.mangadexUpdateReadStatus == 1
    },
    loadings: (state) => state.loadings.find(l=>l.mirror === 'mangadex'),
    texts: (state) => state.texts.find(l=>l.mirror === 'mangadex'),
    misc: (state) => state.misc.find(l=>l.mirror === 'mangadex'),
    inStore: (state, getters, rootState) => rootState.mangas.all.filter(mg => mg.mirror === "MangaDex V5"),
    imports: (state) => state.imports.find(i=>i.mirror === 'mangadex').value
  }
}

/**
 * Actions:
 * functions named after a mirror are used by front-end
 * other functions should stay generic
 */
const actions = {
  async setGlobalOption({dispatch}, {key, value}) {
    return dispatch('setOption', {key, value}, { root: true })
  },
  async initMangadex({getters, dispatch}) {
    mangadex = new Mangadex(getters.mangadex.allOptions, dispatch)
  },
  async mangadexVerifyCredentials({commit, dispatch}, {username, password}) {
    const commitPayload = {mirror: 'mangadex', key:'credential', value: false}
    commit('startLoading', commitPayload)
    try {
      const res = await fetch("https://api.mangadex.org/auth/login", {
        method: "POST",
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({username, password})
      })
      if(res.status == 200) {
        const json = await res.json()
        if(json.result === 'ok') {
          const in13min = Date.now() + (60*1000*13) // 2min margin
          const inAmonthOrSo = Date.now() + (1000*60*60*24*29) // 1 day margin
          await dispatch("setGlobalOption", { key: 'mangadexValidCredentials', value: 1 });
          await dispatch("setGlobalOption", { key: 'mangadexToken', value: json.token.session });
          await dispatch("setGlobalOption", { key: 'mangadexTokenExpire', value: in13min });
          await dispatch("setGlobalOption", { key: 'mangadexRefresh', value: json.token.refresh });
          await dispatch("setGlobalOption", { key: 'mangadexRefreshExpire', value: inAmonthOrSo });
          await dispatch("setGlobalOption", { key: 'mangadexDontRemindMe', value: 0 });
          commitPayload.value = true
          commit('verifyCredentials', commitPayload)
          if(!mangadex) await dispatch('initMangadex')
        }
        commit('verifyCredentials', commitPayload)
      }
      commit('verifyCredentials', commitPayload)
    } catch(e) {
      commit('verifyCredentials', commitPayload)
    }
  },
  async mangadexResetCredentials({commit, dispatch}) {
    await dispatch("setGlobalOption", { key: 'mangadexValidCredentials', value: 0 });
    await dispatch("setGlobalOption", { key: 'mangadexDontRemindMe', value: 0 });
    const commitPayload = {mirror: 'mangadex', key:'credential', value: false}
    commit('verifyCredentials', commitPayload)
  },
  async mangadexExportToList({getters, commit, dispatch}, {ids, fromOptionMenu}) {
    // reset texts and loadings
    commit('setText', { mirror: 'mangadex', key: 'exportProgress', value: undefined})
    commit('setText', { mirror: 'mangadex', key: 'exportTotal', value: undefined})
    commit('setMisc', { mirror: 'mangadex', key: 'exportDone', value: false})
    commit('stopLoading', { mirror: 'mangadex', key: 'export'})
    // force export if action triggered from option menu
    if(!getters.mangadex.options.exportToList) {
      if(!fromOptionMenu) return
    } 
    await dispatch('setGlobalOption', {key: 'isUpdatingChapterLists', value: 1})
    commit('startLoading', { mirror: 'mangadex', key: 'export' })
    if(!mangadex) await dispatch('initMangadex')
    const keys = ids || getters.mangadex.inStore.map(mg => mg.key) // ids aren't provided when using "export all" from Options.Mangadex.vue
    if(fromOptionMenu) {
      // display progress only when using "export all" from Options.Mangadex.vue
      mangadex.on('getCustomList:start', () => {
        commit('setText', { mirror: 'mangadex', key: 'export', value: 'options_mangadex_loading_customList'})
      })
      mangadex.on('exportToList:progress', ({total, current}) => {
        commit('setText', { mirror: 'mangadex', key: 'export', value: 'options_mangadex_export_customList'})
        commit('setText', { mirror: 'mangadex', key: 'exportProgress', value: String(current > total ? total : current)})
        commit('setText', { mirror: 'mangadex', key: 'exportTotal', value: String(total)})
      })
      mangadex.on('exportToList:done', () => {
        commit('setText', { mirror: 'mangadex', key: 'export', value: 'options_mangadex_integration_export_done'})
        commit('setMisc', { mirror: 'mangadex', key: 'exportDone', value: true})
        commit('stopLoading', { mirror: 'mangadex', key: 'export'})
      })
    }
    
    try {
      await mangadex.exportToList(keys)
      await dispatch('setGlobalOption', {key: 'isUpdatingChapterLists', value: 0})
    } catch(e) {
      await dispatch('setGlobalOption', {key: 'isUpdatingChapterLists', value: 0})
    }
  },
  async mangadexExportToFollows({getters, commit, dispatch}, {ids, fromOptionMenu}) {
    // reset texts and loadings
    commit('setText', { mirror: 'mangadex', key: 'exportFollowsProgress', value: undefined})
    commit('setText', { mirror: 'mangadex', key: 'exportFollowsTotal', value: undefined})
    commit('setMisc', { mirror: 'mangadex', key: 'exportFollowsDone', value: false})
    commit('stopLoading', { mirror: 'mangadex', key: 'exportFollows'})
    // force export if action triggered from option menu
    if(!getters.mangadex.options.exportToFollows) {
      if(!fromOptionMenu) return
    }
    await dispatch('setGlobalOption', {key: 'isUpdatingChapterLists', value: 1})
    commit('startLoading', { mirror: 'mangadex', key: 'exportFollows' })
    if(!mangadex) await dispatch('initMangadex')
    const keys = ids || getters.mangadex.inStore.map(mg => mg.key) // mangas aren't provided when using "export all" from Options.Mangadex.vue
    if(fromOptionMenu) {
      // display progress only when using "export all" from Options.Mangadex.vue
      mangadex.on('exportToFollows:start', () => {
        commit('setText', { mirror: 'mangadex', key: 'exportFollows', value: 'options_mangadex_loading_customList'})
      })
      mangadex.on('exportToFollows:progress', ({total, current}) => {
        commit('setText', { mirror: 'mangadex', key: 'exportFollows', value: 'options_mangadex_export_customList'})
        commit('setText', { mirror: 'mangadex', key: 'exportFollowsProgress', value: String(current > total ? total : current)})
        commit('setText', { mirror: 'mangadex', key: 'exportFollowsTotal', value: String(total)})
      })
      mangadex.on('exportToFollows:done', () => {
        commit('setText', { mirror: 'mangadex', key: 'exportFollows', value: 'options_mangadex_integration_export_done'})
        commit('setMisc', { mirror: 'mangadex', key: 'exportFollowsDone', value: true})
        commit('stopLoading', { mirror: 'mangadex', key: 'exportFollows'})
      })
    }
    
    try {
      await mangadex.exportToFollows(keys)
      await dispatch('setGlobalOption', {key: 'isUpdatingChapterLists', value: 0})
    } catch(e) {
      await dispatch('setGlobalOption', {key: 'isUpdatingChapterLists', value: 0})
    }
  },
  async mangadexImportMangas({getters, commit, dispatch}) {
    await dispatch('setGlobalOption', {key: 'isUpdatingChapterLists', value: 1})
    commit('startLoading', { mirror: 'mangadex', key: 'import' })
    const inStoreKeys = getters.mangadex.inStore.map(mg => mg.key)
    if(!mangadex) await dispatch('initMangadex')
    mangadex.on('getFollows:list:progress', ({total, current}) => {
      commit('setText', { mirror: 'mangadex', key: 'importProgress', value: String(current > total ? total : current)})
      commit('setText', { mirror: 'mangadex', key: 'importTotal', value: String(total)})
    })
    let loading = 0
    mangadex.on('getFollows:loading:progress', () => {
      if(loading === 0) {
        commit('setText', { mirror: 'mangadex', key: 'import', value: 'options_mangadex_loading_mangas'})
      }
      loading = loading+1
      commit('setText', { mirror: 'mangadex', key: 'importProgress', value: String(loading)})
    })
    try {
      const follows = await mangadex.getFollows(inStoreKeys)
      commit('addFollows', {follows, mirror: 'mangadex'})
      commit('stopLoading', { mirror: 'mangadex', key: 'import'})
      await dispatch('setGlobalOption', {key: 'isUpdatingChapterLists', value: 0})
    } catch(e) {
      await dispatch('setGlobalOption', {key: 'isUpdatingChapterLists', value: 0})
    }
  },
  
  async mangadexAddManga({commit, dispatch}, {payload, lastOfList}) {
    const mg = new Manga(payload)
    // formSync is true to avoid flooding the sync storage in case of loop
    await dispatch('addManga', {manga: mg, fromSync: true}, {root: true})
    if(lastOfList) await dispatch('initMangasFromDB', true, {root: true})
    commit('removeFromImport', {mirror: 'mangadex', mg})
  },
  async mangadexAddMangasInLang({commit, dispatch}, {payload, lang}) {
    commit('startLoadingLang', {mirror: 'mangadex', lang})
    for(const [i, current] of payload.entries()) {
      await dispatch('mangadexAddManga', {payload: current, lastOfList: i+1 === payload.length})
    }
    commit('stopLoadingLang', {mirror: 'mangadex'})
  },
  /**
   * Triggered by the reader on a single entry
   * meant to be reused if any other integration are added
   * @param {*} param0
   * @param {Object} payload
   * @param {String} payload.url chapter url
   * @param {String} payload.mirror mg.mirrorName
   */
  async exportReadStatus({getters, dispatch}, {url, mirror}) {
    if(mirror === "MangaDex V5") {
      if(!getters.mangadex.options.enabled) return
      if(!getters.mangadex.options.markAsRead) return
      if(!mangadex) await dispatch('initMangadex')
      await mangadex.markAsRead(url)
    }
  },
  /**
   * Triggered when updating chapter lists:
   * retro-actively export read markers
   * meant to be reused if any other integration are added
   */
  async autoExportReadStatus({getters, dispatch}, mg) {
    if(!mg.lastChapterReadURL) return
    if(!mg.listChaps) return
    if(!mg.listChaps.length) return
    const toExport = []
    for(const chap of mg.listChaps.reverse()) {
      toExport.push(chap[1])
      if(chap[1] == mg.lastChapterReadURL) break
    }
    if(mg.mirror === "MangaDex V5") {
      if(!getters.mangadex.options.enabled) return
      if(!getters.mangadex.options.markAsRead) return
      if(!mangadex) await dispatch('initMangadex')
      await mangadex.markAsReadBatch(mg.key, toExport)
    }
  },
  /**
   * Automatically export read manga
   * @param {*} param0 
   * @param {Object} mg Manga
   */
  async exportManga({getters, dispatch}, mg) {
    if(mg.mirror === 'MangaDex V5') {
      if(!getters.mangadex.options.enabled) return
      if(getters.mangadex.options.exportToList) {
        if(!mangadex) await dispatch('initMangadex')
        await mangadex.exportToList([mg.key])
      }
      if(getters.mangadex.options.exportToFollows) {
        if(!mangadex) await dispatch('initMangadex')
        await mangadex.exportToFollows([mg.key])
      }
    }
  },
  async unExportManga({getters, dispatch}, mg) {
    if(mg.mirror === 'MangaDex V5') {
      if(!getters.mangadex.options.enabled) return
      if(getters.mangadex.options.exportToList) {
        if(!mangadex) await dispatch('initMangadex')
        await mangadex.removeFromList([mg.key])
      }
      if(getters.mangadex.options.exportToFollows) {
        if(!mangadex) await dispatch('initMangadex')
        await mangadex.removeFromFollows([mg.key])
      }
    }
  },
}


/**
 * Mutation are used to modify the state of the view
 */
const mutations = {
  startLoading(state, {mirror, key}) {
    const toggle = state.loadings.find(l=>l.mirror === mirror)
    if(toggle) toggle[key] = true
  },
  stopLoading(state, {mirror, key}) {
    setTimeout(() => {
      const toggle = state.loadings.find(l=>l.mirror === mirror)
      if(toggle) toggle[key] = false
    }, 500)
  },
  startLoadingLang(state, {mirror, lang}) {
    const toggle = state.loadings.find(l=>l.mirror === mirror)
    if(toggle) toggle.importLang = lang
  },
  stopLoadingLang(state, {mirror}) {
    setTimeout(() => {
      const toggle = state.loadings.find(l=>l.mirror === mirror)
      if(toggle) toggle.importLang = ''
    }, 500)
  },
  verifyCredentials(state, {mirror, key, value}) {
    setTimeout(() => {
      const toggle = state.loadings.find(l=>l.mirror === mirror)
      if(toggle) toggle[key] = !value
      const credential = state.credentials.find(l=>l.mirror === mirror)
      if(credential) credential.validity = value
    }, 500)
  },
  setText(state, {mirror, key, value}) {
    const text = state.texts.find(t=> t.mirror === mirror)
    if(text) text[key] = value
  },
  setMisc(state, {mirror, key, value}) {
    const misc = state.misc.find(t=> t.mirror === mirror)
    if(misc) misc[key] = value
  },
  addFollows(state, {follows, mirror}) {
    const importState = state.imports.find(i=> i.mirror === mirror)
    importState.value = follows

  },
  removeFromImport(state, {mirror, mg}) {
    const follows = state.imports.find(i=> i.mirror === mirror)
    const entry = follows.value.find(f=> f.key === mg.key.replace('_'+mg.language, ''))
    if(entry) entry.langs = entry.langs.filter(l => l.code !== mg.language)
    follows.value = follows.value.filter(f=> f.langs.length)
  }
}

export default {
  state,
  getters,
  actions,
  mutations
}
