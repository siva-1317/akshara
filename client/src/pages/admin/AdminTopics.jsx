import Card from "../../components/Card";

export default function AdminTopics({ topics, topicName, onTopicNameChange, onAddTopic, loading }) {
  return (
    <>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div>
          <h2 className="section-title mb-1">Topics</h2>
          <p className="text-muted mb-0">Maintain available topics for test creation.</p>
        </div>
        {loading ? <div className="loading-pill">Updating...</div> : null}
      </div>

      <div className="row g-4">
        <div className="col-lg-5">
          <Card title="Add Topic" subtitle="Create a new topic option">
            <form onSubmit={onAddTopic} className="d-grid gap-3">
              <div className="field-shell">
                <input
                  className="form-control create-input"
                  placeholder="Add topic"
                  value={topicName}
                  onChange={(event) => onTopicNameChange?.(event.target.value)}
                />
              </div>
              <button className="btn btn-ak-primary" type="submit" disabled={loading}>
                Add Topic
              </button>
            </form>
          </Card>
        </div>

        <div className="col-lg-7">
          <Card title="Topics List" subtitle="Visible to learners on Create Test">
            <ul className="list-group list-group-flush">
              {(topics || []).length ? (
                topics.map((topic) => (
                  <li key={topic.id} className="list-group-item px-0">
                    {topic.name}
                  </li>
                ))
              ) : (
                <li className="list-group-item px-0 text-muted">No topics yet.</li>
              )}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

