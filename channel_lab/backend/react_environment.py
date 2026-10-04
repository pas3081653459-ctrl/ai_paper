"""真实可执行的封闭教学环境；档案内容为虚构数据，不访问网络或文件。"""
VERSION = 'museum-archive-v1'
TASK = '展品「玻璃之舟」作者的出生城市是什么？请查证后给出城市名及来源文档 ID。'
DOCUMENTS = {
    'E-01': {'title':'玻璃之舟：展品登记', 'text':'玻璃之舟，作者林岚，2021 年制作。作者资料索引 A-07。'},
    'A-07': {'title':'林岚：作者资料', 'text':'林岚出生于海岚市，后来在青州市学习。出生地与求学城市不同。'},
    'E-02': {'title':'纸上之舟：展品登记', 'text':'纸上之舟，作者周芷。不要与玻璃之舟混淆。'},
}


def execute(action, arguments, state):
    """结果写入真实状态；没有根据错误请求补造正确答案。"""
    if action == 'finish':
        answer = arguments.get('answer', '')
        sources = arguments.get('sources', [])
        correct = answer.strip().rstrip('。.!！') == '海岚市'
        grounded = {'E-01','A-07'}.issubset(set(sources)) and {'E-01','A-07'}.issubset(state['read_ids'])
        state['finished'] = True
        return {'answer':answer,'sources':sources,'answer_correct':correct,'evidence_complete':grounded,
                'success':correct and grounded,'note':'正确答案与已取得证据分别检查。'}
    if state['fault'] and not state['fault_used']:
        state['fault_used'] = True
        return {'error':'temporary_unavailable','retryable':True,'message':'档案服务本次暂不可用，没有返回任何资料。'}
    if action == 'search':
        query = arguments.get('query','').strip().casefold()
        if not query:
            return {'error':'empty_query'}
        matches = [{'id':key,'title':doc['title']} for key,doc in DOCUMENTS.items()
                   if query in (key+' '+doc['title']+' '+doc['text']).casefold()]
        return {'matches':matches,'note':'搜索只返回文档索引；读取文档才取得正文证据。'}
    if action == 'read':
        doc_id = arguments.get('document_id','')
        if doc_id not in DOCUMENTS:
            return {'error':'document_not_found','document_id':doc_id}
        state['read_ids'].add(doc_id)
        return {'id':doc_id, **DOCUMENTS[doc_id]}
    return {'error':'unsupported_action'}
