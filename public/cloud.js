export function createCloudStore(client) {
  const check = result => { if (result.error) throw new Error(result.error.message); return result.data; };
  return {
    async load() {
      const page = offset => client.from('dose_entries').select('id,medicine,dose,at,note').order('at', { ascending: false }).order('id').range(offset, offset + 499);
      const [settingsResult, firstPage] = await Promise.all([
        client.from('tracker_settings').select('start').eq('id', 1).single(),
        page(0)
      ]);
      const settings = check(settingsResult);
      const entries = [];
      let result = firstPage;
      for (let offset = 0; ; offset += 500) {
        const rows = check(result);
        entries.push(...rows.map(row => ({ ...row, at: new Date(row.at).toISOString() })));
        if (rows.length < 500) break;
        result = await page(offset + 500);
      }
      return { start: settings.start || '', entries };
    },
    async mutate(action, payload) {
      let query;
      if (action === 'entry') query = client.from('dose_entries').insert({ ...payload, id: crypto.randomUUID() });
      else if (action === 'delete') query = client.from('dose_entries').delete().eq('id', payload.id);
      else query = client.from('tracker_settings').update({ start: payload.start }).eq('id', 1);
      const rows = check(await query.select('id'));
      if (!rows?.length) throw new Error('No change saved. Check your account’s access to this tracker.');
    }
  };
}
